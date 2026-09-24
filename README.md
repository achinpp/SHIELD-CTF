# S.H.I.E.L.D. // Capture The Flag

A self-hosted CTF platform with a S.H.I.E.L.D. house style: a cinematic landing
terminal, self-hosted accounts, and an eight-stage challenge board where each
stage delivers its evidence in whatever way suits the puzzle.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `output: "standalone"`) |
| UI | React 19 + TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) |
| Motion | Motion 13 (`motion/react`) |
| Database | PostgreSQL 17 via `postgres` |
| Passwords | Argon2id (`@node-rs/argon2`) |
| Validation | Zod 4 |
| Image pipeline | `next/image` static imports + `sharp` for asset prep |

## Getting started

The app needs a database. It will build and the landing page will render
without one, but nothing that touches an account will work — so do this first.

### Everything in Docker

One file, one command:

```bash
# .env in the repo root
POSTGRES_PASSWORD=pick-something-random
```

```bash
docker compose up --build        # http://localhost:3000
```

Compose builds `DATABASE_URL` itself from that password and the `db` service
name, and `db/init/*.sql` creates the schema and seeds the board on the
database's first start.

### Local dev server

`npm run dev` runs on the host, so it needs its own connection string **and**
the database container. That is two files:

```bash
# .env — read by Docker, for the database container
POSTGRES_PASSWORD=pick-something-random

# .env.local — read by Next, for the dev server
DATABASE_URL=postgres://shield:pick-something-random@localhost:55432/shield
```

```bash
npm install
npm run db                       # starts Postgres on 127.0.0.1:55432
npm run dev                      # http://localhost:3000
```

Note the port: **55432**, not 5432, so the challenge database cannot collide
with a Postgres already installed on the machine. The password has to match in
both files. Copy `.env.example` and fill it in rather than typing these from
scratch.

> **Signing in fails with "This deployment has no database configured"?**
> `DATABASE_URL` is not set — you are missing `.env.local`, or the dev server
> was started before you wrote it. Both env files are gitignored, so a fresh
> clone never has them.
>
> **"Cannot reach the registry"?** `DATABASE_URL` is set but nothing is
> answering. Run `npm run db`, or check the port is 55432.

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run db` | Start Postgres on `127.0.0.1:55432` |
| `npm run db:stop` | Stop it |
| `npm run db:psql` | psql shell into it |
| `npm run assets:prepare` | Regenerate the alpha plates and app icon |

## The board

Eight stages, ordered by a difficulty ramp. Stage 8 is the meta finale and is
assembled from the other seven.

| # | Stage | Domain | Difficulty | Points |
|---|---|---|---|---|
| 1 | OPERATION GHOSTWATCH | OSINT / Reconnaissance | Easy | 100 |
| 2 | SHIELD Secure Archive Node | Web Technologies / Web Security | Easy | 100 |
| 3 | OPERATION ACCESS LOG | Programming / Scripting | Easy | 200 |
| 4 | OPERATION DEAD END | Linux / System Security | Moderate | 200 |
| 5 | OPERATION COLD STORAGE | Digital Forensics | Moderate | 250 |
| 6 | OPERATION RAVEN | Steganography | Moderate | 300 |
| 7 | OPERATION LOCKSTEP | Cryptography | Moderate | 350 |
| 8 | OPERATION KEYSTONE | Miscellaneous / Capstone | Hard | 500 |

**Stages 1 and 5 are still placeholders** — their text says so on its face,
though their flag digests are already the real ones. **Stage 8 is being
redesigned** and cannot be solved yet. Every other row is finished.

Stages live in `db/init/02-challenges.sql`, one row each, carrying the
briefing, objectives, hint and the **SHA-256 of the flag** — never the flag.
Author write-ups are gitignored (`challenge0N.md`) and must never be committed.

Because `db/init/` only runs on an empty data directory, editing that file has
no effect on a database that already exists. Either `docker compose down -v`
(which drops every account) or apply an `UPDATE` by hand.

## How a stage delivers its evidence

Four shapes, picked to suit the puzzle rather than for uniformity:

| Shape | Used by | Why |
|---|---|---|
| **Query terminal** | 03 | The log is the haystack. It is queryable but never exportable, because handing over the file makes the stage skippable. |
| **Gated download** | 06, 07 | The file *is* the puzzle, so it has to be handed over — through a route that re-checks the session, not from `public/`. |
| **Live target** | 02 | A legacy archive node at `/archive`, served by this app. Reconnaissance against a running service. |
| **Mounted image** | 04 | A read-only disk image of a workstation, walked through a simulated shell. Nothing executes. |

Everything a stage serves lives under `data/challenges/`, deliberately outside
`public/` — a file under `public/` is a permanent unauthenticated URL that
works for anyone who is ever given it.

## Authentication

Self-hosted, no third party.

- **Passwords** — Argon2id at 19 MiB / t=2 / p=1. A missing account still
  hashes a decoy so response time cannot be used to discover which codenames
  exist.
- **Sessions** — opaque random tokens in an httpOnly cookie; only the token's
  SHA-256 is stored, so a database leak cannot be replayed as a login. Every
  request resolves against the database, so revocation is immediate.
- **Throttling** — 5 failed sign-ins per identifier and 20 per IP per 15
  minutes; 10 flag submissions per minute.
- **Authorisation** — `requireUser()` in `src/lib/auth/dal.ts`, called by every
  protected page and action. `src/proxy.ts` only checks whether a cookie is
  *present*, to save an unauthenticated visitor a round trip — it is not the
  gate and is not treated as one.

Flags are compared as SHA-256 digests with `timingSafeEqual`, and never leave
the server: `src/lib/challenges.ts` is `server-only`, and the client-safe
shapes live in `src/lib/challenge-format.ts` so a Client Component can render a
challenge without pulling flag checking into the browser bundle.

## How the artwork is composed

All four source plates are 16:9 full-frame layers that stack to reproduce the
design exactly, so the page is a stack of absolutely-positioned layers inside
one 16:9 stage rather than a hand-built layout.

**The source plates have no alpha channel.** `cool-lock.png`, `capture.png` and
`some-text.png` ship as 24-bit RGB flattened onto solid white, so stacking them
directly just paints white over the backdrop. `scripts/prepare-plates.mjs`
recovers the real alpha: each layer is known over two different backdrops — flat
white (the supplied plate) and the design composite over `background.png` — and
subtracting the two eliminates the unknown colour, leaving alpha exactly.

```
plate = C·a + 255·(1 - a)          →   (1 - a) = Σ(plate - ref) / Σ(255 - B)
ref   = C·a +   B·(1 - a)              C·a     = ref - B·(1 - a)
```

Plates are solved back-to-front so each is measured against the backdrop it was
actually composited over. The reconstruction lands within **2.75/255 mean
absolute error** of the original design, reported every time the script runs.

Regenerate with `npm run assets:prepare`. Output goes to `src/assets/plates/`
and is committed, so a plain `npm install && npm run build` needs no image work.

## Sequence

Every cue and easing curve lives in `src/lib/sequence.ts` — adjust timings
there rather than in the component.

| t (s) | Layer | Motion |
|---|---|---|
| 0.00 | backdrop | fades up from black; **fixed** thereafter — never pans or scales |
| 0.45 | crest | scale 0.42 → 1 with blur and brightness falling off, over 3.0s |
| 3.25 | title | scale 1.14 → 1 with an impact flash and a one-shot RGB split |
| 4.00 | subtitle | fade and rise |
| 4.75 | chrome | access CTA |

Once settled, the crest picks up a slow breathing drift and the keyhole glow
pulses.

- **Skip** — click, tap, or press `Esc` / `Enter` / `Space` during playback.
- **Reduced motion** — `prefers-reduced-motion: reduce` renders the finished
  composition immediately, with all idle animation disabled.

## Responsive behaviour

The art lives in a 16:9 stage sized by `--stage-width` in `globals.css`. At 16:9
and wider it is contain-fit and pillarboxed over the backdrop; on taller
viewports it grows to 1.35× the viewport width and bleeds off the sides. The
title occupies 18%–83% of the frame, so that crop only ever reaches the outer
wing tips. The CTA is anchored to the viewport rather than the stage so it
lands under the clearance line on 16:9 and in clear space on tall screens.

## Layout

```
compose.yaml                 platform stack: web + db
Dockerfile                   multi-stage build; runtime carries no toolchain
db/init/                     schema and board seed — run once, on an empty volume
data/challenges/             stage artifacts, deliberately outside public/

src/app/page.tsx             the landing cinematic
src/app/challenges/          the board and the per-stage pages
src/app/archive/             stage 02's target — a legacy archive node
src/app/actions/             server actions: auth, flags, consoles
src/proxy.ts                 optimistic route gate (cookie presence only)

src/lib/auth/                sessions, Argon2id, rate limiting, the DAL
src/lib/challenges.ts        board data access and flag checking (server-only)
src/lib/log-console.ts       stage 03's query terminal
src/lib/workstation.ts       stage 04's read-only disk image and shell
src/lib/evidence.ts          stage 06/07 gated downloads
src/lib/targets.ts           stage 02's live target
src/lib/sequence.ts          cue times, durations, easing curves

design/full-image.png        reference composite — ground truth for asset prep
scripts/prepare-plates.mjs   alpha recovery + app icon generation
src/assets/plates/           generated alpha plates — imported by the app
```
