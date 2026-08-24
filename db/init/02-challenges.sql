-- S.H.I.E.L.D. CTF — challenge board.
--
-- ─────────────────────────────────────────────────────────────────────────
--  STAGES 3 AND 5 ARE REAL. THE OTHER FOUR ROWS ARE EMPTY PLACEHOLDERS.
--
--  The placeholders exist so the board and the per-challenge pages render and
--  the solve mechanics can be tested. Every text field says so on its face and
--  every placeholder flag is `SHIELD{placeholder_...}`, so nothing there can be
--  mistaken for real content. The group replaces each one as its stage is
--  designed; a finished row carries a comment saying where its artifact lives.
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


-- ── Placeholder rows ────────────────────────────────────────────────────
-- Structure only: six stages, the brief's difficulty ramp (1-2 Easy,
-- 3-4 Moderate, 5-6 Hard) and a sequential unlock chain. Domain labels are
-- unassigned until the group picks them.
--
-- `digest(...,'sha256')` needs pgcrypto; it is only used here, at seed time.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO challenges
  (stage, slug, title, domain, difficulty, points, summary, scenario, task, intel_note, flag_hash, hint, hint_penalty, requires_stage)
VALUES
  (1, 'stage-01', 'Challenge 01', 'Domain TBC', 'Easy', 100,
   'Placeholder summary for stage one. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   NULL,
   digest('SHIELD{placeholder_one}', 'sha256'),
   'Placeholder hint.', 10, NULL),

  (2, 'stage-02', 'Challenge 02', 'Domain TBC', 'Easy', 100,
   'Placeholder summary for stage two. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   NULL,
   digest('SHIELD{placeholder_two}', 'sha256'),
   'Placeholder hint.', 10, 1),

  -- Stage 3 is complete: the artifact lives at
  -- `data/challenges/stage-03/access.log` — off the web root, readable only
  -- through the page's query terminal — and the hash below is the real flag's.
  -- Still provisional: the stage is deliberately ungated (requires_stage NULL)
  -- so the card stays reachable from the board while stages 1-2 are empty.
  -- Restore the gate to 2 once those are written.
  (3, 'stage-03', 'Challenge 03', 'Scripting', 'Easy', 200,
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
   25, NULL),

  (4, 'stage-04', 'Challenge 04', 'Domain TBC', 'Moderate', 200,
   'Placeholder summary for stage four. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   NULL,
   digest('SHIELD{placeholder_four}', 'sha256'),
   'Placeholder hint.', 25, 3),

  -- Stage 5 is complete: the artifact lives at
  -- `data/challenges/stage-05/raven_recovered.png`. Off the web root like the
  -- stage-03 log, but for a different reason — steganography *is* the file, so
  -- it has to be handed over. The gated route at `/challenges/[slug]/evidence`
  -- is what hands it over, after re-checking the session and the unlock.
  -- Ungated for now (requires_stage NULL) so the card stays reachable while
  -- stage 4 is still a placeholder. Restore the gate to 4 once it is written.
  (5, 'stage-05', 'OPERATION RAVEN', 'Steganography', 'Moderate', 300,
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
   decode('0e13457eea2868d0b4cd521940da7ca8bb426db4c82f184f53975617cc296399', 'hex'),
   'The photograph you can see is only the top six bits of every colour channel. Throw those away, keep the two lowest bits of each channel and rescale them — a bit-plane viewer, or four lines of Pillow, will show you what the low bits were really drawing.',
   40, NULL),

  (6, 'stage-06', 'Challenge 06', 'Domain TBC', 'Hard', 400,
   'Placeholder summary for stage six. Replace with a one-line teaser.',
   'Placeholder briefing. The capstone scenario has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   NULL,
   digest('SHIELD{placeholder_six}', 'sha256'),
   'Placeholder hint.', 50, 5);
