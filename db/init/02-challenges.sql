-- S.H.I.E.L.D. CTF — challenge board.
--
-- ─────────────────────────────────────────────────────────────────────────
--  EVERY STAGE IS REAL. Stage 8 is built, but only solvable once every
--  earlier stage carries its KEYSTONE share — see its row. Each row carries a
--  comment saying where its artifact lives.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE challenges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stage number drives ordering and the difficulty ramp.
  stage      integer NOT NULL UNIQUE CHECK (stage > 0),
  -- Used in the URL: /challenges/<slug>
  slug       text NOT NULL UNIQUE,
  title      text NOT NULL,

  domain     text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('Easy', 'Moderate', 'Hard')),
  points     integer NOT NULL CHECK (points > 0),

  -- One line shown on the board card.
  summary    text NOT NULL,
  -- The full text, shown only on the challenge's own page.
  scenario   text NOT NULL,
  -- One objective per line; rendered as a list.
  task       text NOT NULL,
  -- Optional in-world aside, rendered as a pull quote. Flavour, not a hint.
  intel_note text,

  -- SHA-256 of the flag, never the flag itself. A dump of this table hands
  -- an attacker nothing usable: flags are high-entropy, so unlike passwords
  -- a plain hash is enough and there is no dictionary to run against it.
  flag_hash  bytea NOT NULL,

  hint          text,
  -- Points forfeited for revealing the hint.
  hint_penalty  integer NOT NULL DEFAULT 0 CHECK (hint_penalty >= 0),

  -- A stage can be gated behind an earlier one.
  requires_stage integer REFERENCES challenges (stage),

  published  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX challenges_stage_idx ON challenges (stage);

-- One row per agent per solved challenge. The primary key makes a second
-- solve impossible, so points cannot be farmed by resubmitting.
CREATE TABLE solves (
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges (id) ON DELETE CASCADE,
  solved_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

CREATE INDEX solves_user_idx ON solves (user_id);

-- Feeds the submission throttle. Without one, a flag is just a short string
-- an attacker can grind at machine speed.
CREATE TABLE flag_attempts (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges (id) ON DELETE CASCADE,
  correct      boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flag_attempts_pk UNIQUE (id)
);

CREATE INDEX flag_attempts_user_idx ON flag_attempts (user_id, attempted_at);


-- ── The board ───────────────────────────────────────────────────────────
-- The master report's eight stages: 1-3 Easy, 4-7 Moderate, 8 Hard, and a
-- sequential unlock chain. Stage 8 is the operation's finale.
--
-- Every row is a finished stage and says on its face where its artifact lives.
--
-- Gates: every stage after the first is gated on the stage before it.
--
-- `digest(...,'sha256')` needs pgcrypto; it is only used here, at seed time.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO challenges
  (stage, slug, title, domain, difficulty, points, summary, scenario, task, intel_note, flag_hash, hint, hint_penalty, requires_stage)
VALUES
  -- Stage 1 is complete on the platform side: the case file lives at
  -- `data/challenges/stage-01/KRAKEN-0017_case_file.zip`, handed over by the
  -- gated evidence route like stages 6 and 7. It is the one stage whose trail
  -- leaves the repository — the ZIP only opens it, and the rest runs across
  -- public GitHub and X accounts (nighthawk1011 → nighthawk_1011 →
  -- stormsignal_ny → stormsignalny). Those accounts, and the flag planted at
  -- the end of them, are not in this repository and must be re-checked before
  -- every event. See `challenge01.md`.
  --
  -- The first stage, so it is never gated.
  (1, 'stage-01', 'OPERATION GHOSTWATCH', 'OSINT / Reconnaissance', 'Easy', 100,
   'One handle, one photograph, one line of text. Somebody is behind nighthawk1011, and they have been careless before.',
   'Case KRAKEN-0017 is open, agent.

At 02:17 a restricted SHIELD network was breached. The intruder was through several layers of authentication before anybody noticed and gone before anybody arrived. No face, no fingerprints, no name.

What they left behind is a handful of fragments pulled off the compromised system, and one identifier that keeps turning up in all of them: nighthawk1011. It matches no SHIELD employee, no contractor and no known KRAKEN operative on file.

Analysts think the person behind it lives a fairly ordinary life online — side projects, interests, the odd post — and that they are not as careful about it as they are about breaking into networks. Handles get reused. Pictures get reposted. Phrases get repeated. Some of the accounts have been left to go quiet, but quiet is not the same as gone.

The case file is below. Everything you need to start is in it, and nothing you need to finish is. Follow the handle out into the open and do not name anybody until the evidence agrees with itself.',
   'Open the case file below and read everything in it — including what the photograph says about itself.
Take the handle out onto the open internet and find where it has been used.
Follow the links between accounts, and confirm each hop against something from the case file before trusting it.
Identify the person behind nighthawk1011. The flag is waiting where the trail ends.',
   'People hide their real names well enough. What gives them away is everything they could not be bothered to change.',
   -- The flag from the master report, as a digest rather than digest('...')
   -- over the plaintext so it is not greppable in this file.
   decode('c5fee86c75ad576c237697f078c7b3a383f494187c5e41a0e2c5d2d28a5a1b65', 'hex'),
   'Don''t stop at the first account you find. The suspect reused something from the case file on another profile.',
   10, NULL),

  -- Stage 2 is complete, and it is the one stage whose evidence is not a file.
  -- The artifact is a live target: the archive node at `/archive`, served by
  -- this application from `src/app/archive/`. The stage page prints its address
  -- from `@/lib/targets`.
  --
  -- It was briefly a separate Flask container on port 8080. It is a route now
  -- so the whole operation sits on one origin, in one palette, with one session
  -- and nothing extra to deploy. The two files it hands out live in
  -- `data/challenges/stage-02/`, off the web root like every other stage's
  -- material, and the `X-Sync-Cluster` clue is attached in `next.config.ts`
  -- because a Server Component cannot set a response header.
  --
  -- It feeds stage 3 directly. The "forgotten endpoint containing an
  -- access.log" that stage 3 opens on is the trace subsystem an agent breaks
  -- into here, so the two are played in order.
  --
  -- Gated on stage 1, which follows the breach to this node.
  (2, 'stage-02', 'SHIELD Secure Archive Node', 'Web Technologies / Web Security', 'Easy', 100,
   'A legacy archive server KRAKEN left running. Everything on it answers honestly — to anyone who knows what to ask.',
   'The archive server is still up, agent.

That is the first thing that should bother you. KRAKEN went through it four days before the facility breach and left it running — nothing wiped, nothing defaced, no note. Whoever did this wanted the box to keep answering, which means they got what they came for and saw no reason to burn it on the way out.

The public face of it is clean. Monitoring has been over the gateway a dozen times: the front page is a front page, the status endpoints are honest, and every link on it goes where it says it goes.

What is not linked is the problem. This host has been in service since the archive was stood up and it carries the whole sediment of it — synchronization subsystems retired without ever being removed, diagnostic partitions that still answer to parameters nobody has typed in years, and a quarantined incident report somebody meant to take off the disk and never did.

KRAKEN read all of it. You are going to read it too.

Nothing here needs an exploit. The archive will tell you everything it knows — it simply will not volunteer it, and what it does give up it gives up in pieces.',
   'Map the archive at the address below, starting with what it asks crawlers not to index.
Read the quarantined incident report in the markup and in the response headers both — neither half is the whole clue.
Work out which synchronization node the incident points at, and ask the restricted trace subsystem for it the way it expects to be asked.
Recover the fragments it releases, restore the order they were written in, and reconstruct what they spell.',
   'Nobody decommissioned that subsystem. They stopped linking to it, and assumed that was the same thing.',
   -- The digest rather than digest('...') over the plaintext, for the same
   -- reason as the other finished stages: this file is committed, and a flag
   -- spelled out here would be greppable. `data/challenges/stage-02/old.log`
   -- is committed too, but it carries the flag only in encoded fragments —
   -- taking it apart is the stage.
   decode('623b505ff12b8e4bb27370cf44d47dbe0e76434967208503cd064bcb2315500b', 'hex'),
   'Start at /robots.txt: a disallow list is a list of the things worth looking at, and this one names an incident page and a restricted trace path. The incident page carries half a sentence in an HTML comment and the other half in a response header — fetch the headers too (curl -I) — and both halves are Base32. Together they name a node number. Hand that number to the trace path as a query parameter, ?node=<n>, and the 403 becomes a 200. The log behind it holds seven fragments printed out of order, each tagged with its own sequence=. Sort by that, Base32-decode every payload, join them end to end, and Base64-decode the string you are left with.',
   10, 1),

  -- Stage 3 is complete: the artifact lives at
  -- `data/challenges/stage-03/access.log` — off the web root, readable only
  -- through the page's query terminal — and the hash below is the real flag's.
  --
  -- Gated on stage 2, the stage this one continues from — the forgotten
  -- endpoint below is the trace subsystem stage 2 breaks into.
  (3, 'stage-03', 'OPERATION ACCESS LOG', 'Programming / Scripting', 'Easy', 200,
   'A forgotten endpoint left an access.log behind. Thousands of requests, and one visitor who should not be there.',
   'Agent, your previous investigation has uncovered a critical lead.

While investigating the SHIELD archival server, you discovered a forgotten endpoint containing an access.log. The file records network activity from shortly before the breach.

SHIELD analysts believe the attacker identified as "KRAKEN" may have used the archive server as a staging point before accessing other SHIELD infrastructure.

The record never left the archive host and it is not going to. Analysts reach it through the read-only query terminal below, which answers filters and tallies over the traffic but releases only a handful of raw lines at a time.

Thousands of legitimate requests are mixed with the attacker''s. Volume alone will not get you there — reason your way down to the few lines that matter, then work out what they carried out of the building.',
   'Profile the access.log through the archive query terminal.
Identify the suspicious IP address associated with the breach.
Find the unusual requests made by the attacker.
Extract the hidden flag from the attacker''s activity.',
   'The attacker didn''t erase everything. They simply assumed nobody would have the patience to look through it.',
   -- The digest itself rather than digest('...') over the plaintext: this
   -- file is committed, and a flag spelled out here would be greppable.
   decode('c87422591cee37f5aec64d95341738bed59ea04fa12c6c3a4838920c98661258', 'hex'),
   'Look for patterns that separate normal SHIELD archive traffic from the attacker''s requests. Pay particular attention to unusual endpoints, repeated requests, and abnormal HTTP responses.',
   25, 2),

  -- Stage 4 is complete. Its evidence is a mounted disk image rather than a
  -- file or a live target: `data/challenges/stage-04/workstation.json`, walked
  -- by the read-only shell in `@/lib/workstation` and rendered by the terminal
  -- on the stage page.
  --
  -- It shipped as an interactive Docker box with a TTY, which cannot be a web
  -- page. What it *also* shipped with was a simulated shell in its launcher,
  -- and that is what is modelled here — nothing executes, every command is a
  -- lookup against frozen JSON. The stage loses nothing by it: the box was
  -- never solved by running anything, only by correlating auth.log, two shell
  -- histories, a sudoers drop-in and a hidden note.
  --
  -- The flag sits in `/home/svc_archive/.doorway`, held base64 in the JSON so
  -- a grep of this repository does not turn it up, and decoded only when an
  -- agent actually cats the file. The image's own `submit_flag` was rewritten
  -- to check a digest: as shipped it compared against the literal flag, so
  -- `cat /usr/local/bin/submit_flag` skipped the entire investigation.
  --
  -- One of the stages whose gate was never provisional: stage 3 has always
  -- been real, so `requires_stage = 3` has always stood.
  (4, 'stage-04', 'OPERATION DEAD END', 'Linux / System Security', 'Moderate', 200,
   'Your own workstation launched the attack. One night, one disk image, and your name on the incident report.',
   'Read this before anybody else does, agent.

Security traced the breach back to SHIELD-WKS-006. That is your desk, your machine and your credentials, which as far as the incident report is concerned makes you the one who did it. Nobody has said the word yet. They will.

Somebody who would rather not be named left an envelope where you would find it. Inside was a USB: a forensic image of your own workstation, pulled before the machine was sealed and carrying everything the disk still had — the authentication record, the shell histories, the hidden files. It is mounted below, read-only.

The account that logged in that night was yours. The key that let it in was not. Something on this machine wrote that key into your profile a few minutes before the intruder arrived, and whatever did it already had standing permission to act as you.

So the question is not how they got in. You know how they got in; they walked through your front door with your name on them. The question is who cut the key, and that is on this disk in four separate places, none of which says it outright.

You are on your own with this, agent, and the clock started when the envelope did.',
   'Mount the image below and get your bearings — the files worth reading are the ones a plain `ls` will not show you.
Establish when the intruder was on the machine, and what address they came from.
Read the authentication record around that time rather than only grepping it; something happens minutes before the login that matters more than the login.
Work out which account held the standing permission to act as you, and recover what it left behind in its own home directory.',
   'Nobody breaks into a building they already hold a key to. They get somebody on the inside to cut them one.',
   -- The digest rather than digest('...') over the plaintext, for the same
   -- reason as the other finished stages: this file is committed, and a flag
   -- spelled out here would be greppable.
   decode('07af9a68cbf30e52f54b3ada87899575b0dd98226a40d9c31f28b2165860db06', 'hex'),
   'Start with `ls -la` in the home directory: the two things worth reading are both hidden, and one of them is a directory. `.shield/.trace` gives you the time of the intrusion and the address it came from. Take that address to `/var/log/auth.log` and read the lines *around* it instead of only the ones that match — about three minutes before the SSH login, a sudo entry shows a different account running a command as agent006 and appending to that account''s authorized_keys file. `/etc/passwd` tells you what that account is, and `/etc/sudoers.d/` tells you why it was allowed to. Then look in its home directory, with `-a`.',
   25, 3),

  -- Stage 5 is complete: the artifact lives at
  -- `data/challenges/stage-05/safehouse.img`, a bare 16 MiB ext4 filesystem
  -- handed over by the same gated route as stages 1, 6 and 7. It is a disk
  -- image like stage 4's, but not mounted behind a simulated shell: the stage
  -- is about deleted entries, freed inodes and unallocated blocks, and only
  -- the raw image carries those, so agents open it in Autopsy or The Sleuth
  -- Kit.
  --
  -- The flag is in `Downloads/travel_confirmation.txt`, one of the two files
  -- removed with `rm`, as a Base64 booking reference — so a `strings` over
  -- the image does not turn up `SHIELD{`. The third file was `shred -u`'d and
  -- is gone for good. `Pictures/harbor.jpg` carries the KEYSTONE share in its
  -- EXIF UserComment. The image's generator is in `challeng05.md`.
  --
  -- Gated on stage 4: the intruder's address there is what leads to this
  -- safehouse.
  (5, 'stage-05', 'OPERATION COLD STORAGE', 'Digital Forensics', 'Moderate', 250,
   'An empty safehouse, a warm machine, and a man who left in a hurry. He cleaned up on the way out. Not well enough.',
   'The address in the workstation logs led somewhere, agent.

10.13.37.91 resolved to a rented apartment in Washington — a KRAKEN safehouse, and the one Evan Storm has been working out of. SHIELD had a team at the door within the hour. It was empty. The kettle was still warm.

Storm left at speed, and not on his own schedule. Somebody told him we were coming, and told him in time for him to book a way out and to start destroying things before he went.

He did not take the machine. Forensics pulled a bit-for-bit image of its disk before anybody touched it, and that image is below. It is the last thing Storm did before he disappeared, and he spent the final few minutes of it trying to make sure there would be nothing on it for you to read.

He was in a hurry. People in a hurry use whatever they already know, and whatever they already know is not always as permanent as they think.

Work out what he was doing, what he tried to destroy, and where he went.',
   'Recover safehouse.img from the evidence locker below and open it as evidence, read-only — do not mount it and write to it.
Find the suspect''s home directory and reconstruct his last night from what the machine recorded about it.
Work out what he tried to destroy, and how he destroyed each thing.
Recover whatever can still be recovered, and establish where he was going. The flag travels with him.',
   'A man who deletes his tracks at four in the morning has already told you he had tracks worth deleting.',
   -- The flag from the master report, as a digest rather than digest('...')
   -- over the plaintext so it is not greppable in this file.
   decode('9bd909dcac8fd7a1c497562f1194acd8301ba86e9a43859e15b272ac0df4973e', 'hex'),
   'The suspect tried to cover their tracks, but not every deletion is permanent. Check how each file was removed.',
   25, 4),

  -- Stage 6 is complete: the artifact lives at
  -- `data/challenges/stage-06/raven_recovered.png`. Off the web root like the
  -- stage-03 log, but for a different reason — steganography *is* the file, so
  -- it has to be handed over. The gated route at `/challenges/[slug]/evidence`
  -- is what hands it over, after re-checking the session and the unlock.
  --
  -- Gated on stage 5, whose recovered notes name RAVEN for the first time.
  (6, 'stage-06', 'OPERATION RAVEN', 'Steganography', 'Moderate', 300,
   'A photograph recovered minutes before the archive went dark. It opens cleanly — and that is the problem.',
   'Forensics pulled a single image off SHIELD-WKS-006, written four minutes before the archive server stopped answering.

As far as the file browser is concerned it is a photograph and nothing else. It opens, it renders, the metadata is unremarkable, and every checksum the recovery tool ran came back clean. Nothing is appended to it and nothing is embedded in it.

What is not unremarkable is the access pattern. In the last hour of its life the file was opened, rewritten and reopened eleven times by the same process, and then deleted. Nobody edits a photograph eleven times and then destroys it.

KRAKEN''s operators do not carry payloads out as attachments. They carry them inside things that are already allowed to leave the building.

The picture is intact, agent. Look underneath it.',
   'Recover the artifact from the evidence locker below.
Rule out the obvious carriers first — metadata, trailing data, embedded archives.
Read the image at the bit level: ask what is left when the photograph itself is thrown away.
Recover the marker hidden in the pixel data and read what it carries.',
   'Nothing was appended to that file and nothing was attached to it. Whatever they moved, they moved in plain sight — one bit at a time.',
   -- The digest rather than digest('...') over the plaintext, for the same
   -- reason as stage 3: this file is committed, and a flag spelled out here
   -- would be greppable.
   decode('36079f894e1c187f77af8aa99a6fd65f7bc813eb66389c4900046abfe8c9706e', 'hex'),
   'The photograph you can see is only the top six bits of every colour channel. Throw those away, keep the two lowest bits of each channel and rescale them — a bit-plane viewer, or four lines of Pillow, will show you what the low bits were really drawing.',
   40, 5),

  -- Stage 7 is complete: the artifact lives at
  -- `data/challenges/stage-07/lockstep_intercept.json`, handed over by the same
  -- gated route as stage 06 — the intercepted traffic is the puzzle, so there
  -- is nothing to withhold. Gated on stage 6.
  --
  -- Deliberately long rather than deep: 72 packed message bodies, six of which
  -- are a shifted broadcast carrying one phrase in six pieces. Every step is a
  -- beginner step; the cost is patience, not technique. See `challeng07.md`.
  (7, 'stage-07', 'OPERATION LOCKSTEP', 'Cryptography', 'Moderate', 350,
   'One night of radio traffic off KRAKEN''s relay mesh. Seventy-two messages, and six of them are not chatter.',
   'Signals handed us INTERCEPT-4471 an hour ago, agent: everything KRAKEN''s relay mesh sent between 1800 and 0600 on the night the archive went dark.

It is not encrypted. The mesh packs its message bodies up for transmission and that is all it does to them, so most of this opens the moment you unpack it — dock chatter, weather, complaints about batteries. Seventy-two messages of people talking about their night shift.

Six of them are not that. KRAKEN command sends over the same net as its stations and does not mark its own traffic in any way, so the only thing separating an order from a complaint about a generator is that the order still does not read as anything after you unpack it. Those six were shifted along the alphabet before they were sent — the oldest trick there is, and it falls over the moment you try every shift there is.

What command sent that night was a single standing phrase, cut into six pieces and read out one piece at a time across eleven hours. No one message carries it. Collect all six, put them back together the way command tells its own stations to, and you are holding the phrase.

None of this is difficult, agent. It is just long. Sit with it.',
   'Recover INTERCEPT-4471 from the evidence locker below.
Unpack every message body — all seventy-two of them — and read what comes out.
Set aside the six that still do not read as anything, and break the shift they were sent under.
Reassemble the six pieces in the order command gives, and submit the phrase they spell.',
   'They did not hide it, agent. They cut it into six and read it out over eleven hours, and trusted that nobody would sit through the whole night.',
   -- The digest rather than digest('...') over the plaintext, for the same
   -- reason as stages 3 and 6: this file is committed, and a flag spelled out
   -- here would be greppable.
   decode('109e8a1811474b0ff0d74a5a976114771ec5114f16773fd8b6345f5001525043', 'hex'),
   'The bodies are Base64. Decode all seventy-two and sixty-six of them read as ordinary English. The other six are the same message shifted a fixed number of letters along the alphabet — try all twenty-five shifts on any one of them and the rest open with the same shift. Each one then spells its piece of the phrase in the NATO phonetic alphabet, with digits read out as spoken numbers, so DELTA FOUR ROMEO KILO reads d4rk. Six pieces, joined in number order with underscores between them, all in lower case.',
   30, 6),

  -- Stage 8 is the operation's finale and its meta stage: OPERATION KEYSTONE.
  --
  -- The artifact lives at `data/challenges/stage-08/keystone.capsule`, handed
  -- over by the gated evidence route: KRAKEN's kill-switch order, AES-256-GCM
  -- under SHA-256 of a secret split 7-of-7 (Shamir over GF(2^127 - 1)) across
  -- the earlier stages, one share beside each stage's flag. The capsule gives
  -- nothing away on its own, so it is safe to hand over; the stage is
  -- collecting the shares. The flag is the stand-down phrase at the end of the
  -- decrypted order.
  --
  -- ⚠ Solvable only once every share is planted. At the time of writing only
  -- stage 5's (EXIF in `safehouse.img`) is; the other six are listed in
  -- `future project work.md`. `npm run keystone:verify` is the reference
  -- solver: it checks the shares against the capsule and this row's digest,
  -- and must pass before the event runs. See `challeng08.md`.
  --
  -- One of two stages whose gate is load-bearing rather than provisional:
  -- `requires_stage = 7` is what makes the onward button appear on the stage-07
  -- page the moment its flag lands, and the finale is not meant to be reachable
  -- before then. Leave it at 7.
  (8, 'stage-08', 'OPERATION KEYSTONE', 'Miscellaneous / Capstone', 'Hard', 500,
   'Seven cells, seven shares, one sealed order. The mesh goes dark at midnight, and you have been carrying the key since the first night.',
   'The capsule came off NODE-17 an hour ago, agent, and the clock on the wall says the rest of this is measured in hours.

Storm is on his way to New York to hold the relay. RAVEN has warned the cell. And at 00:00 KRAKEN''s relay mesh goes dark — whatever it is carrying goes with it, and so does every chance of reading it.

What we seized is KEYSTONE: the kill-switch order that holds the whole operation together, sealed under a key that no single cell was ever trusted with. KRAKEN cut that key into seven shares and gave one to each of its cells, so that no one cell could fire the order, stop it or sell it. Every share has to be present. Six is as good as none.

You have spent this investigation taking those cells apart one at a time. Each of them gave up its flag. What nobody has noticed until now is that each of them also gave up something else — a short value, hidden beside the flag, in whatever way that cell hid everything else.

Seven stages. Seven shares. You have walked past every one of them.

Go back and collect them. The capsule tells you what to do with them once you have them, if you read it the way its own cells would. Open it, find out who opened the doorway, and stand the operation down before midnight.',
   'Recover keystone.capsule from the evidence locker below and read its header closely — it names the method without spelling it out.
Go back through all seven stages you have cleared and recover the share each one hid beside its flag.
Rebuild the secret the seven shares were cut from; with even one share wrong or missing, nothing comes out.
Derive the key the capsule describes, open it, and submit the stand-down phrase at the end of the order.',
   'No cell was ever trusted with the whole key. That was the point. It never occurred to anybody that one agent might take all seven cells apart.',
   -- The digest rather than digest('...') over the plaintext, for the same
   -- reason as the other finished stages: this file is committed, and a flag
   -- spelled out here would be greppable. The capsule carries the plaintext
   -- only under AES-256-GCM.
   decode('91aac0ec6e6c3b60bb3d930a275ad7bde53614f3a975e1e552895dadbf71b33a', 'hex'),
   'The capsule is only half of this stage. Every stage you cleared also hid a second value beside its flag.',
   60, 7);
