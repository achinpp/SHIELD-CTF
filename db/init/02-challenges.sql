-- S.H.I.E.L.D. CTF — challenge board.
--
-- ─────────────────────────────────────────────────────────────────────────
--  THE SIX SEED ROWS ARE EMPTY PLACEHOLDERS, NOT CHALLENGES.
--
--  They exist so the board and the per-challenge pages render and the solve
--  mechanics can be tested. Every text field says so on its face and every
--  flag is `SHIELD{placeholder_...}`, so nothing here can be mistaken for
--  real content. The group replaces all of it when the stages are designed.
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
  task       text NOT NULL,

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
  (stage, slug, title, domain, difficulty, points, summary, scenario, task, flag_hash, hint, hint_penalty, requires_stage)
VALUES
  (1, 'stage-01', 'Challenge 01', 'Domain TBC', 'Easy', 100,
   'Placeholder summary for stage one. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   digest('SHIELD{placeholder_one}', 'sha256'),
   'Placeholder hint.', 10, NULL),

  (2, 'stage-02', 'Challenge 02', 'Domain TBC', 'Easy', 100,
   'Placeholder summary for stage two. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   digest('SHIELD{placeholder_two}', 'sha256'),
   'Placeholder hint.', 10, 1),

  (3, 'stage-03', 'Challenge 03', 'Domain TBC', 'Moderate', 200,
   'Placeholder summary for stage three. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   digest('SHIELD{placeholder_three}', 'sha256'),
   'Placeholder hint.', 25, 2),

  (4, 'stage-04', 'Challenge 04', 'Domain TBC', 'Moderate', 200,
   'Placeholder summary for stage four. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   digest('SHIELD{placeholder_four}', 'sha256'),
   'Placeholder hint.', 25, 3),

  (5, 'stage-05', 'Challenge 05', 'Domain TBC', 'Hard', 300,
   'Placeholder summary for stage five. Replace with a one-line teaser.',
   'Placeholder briefing. The scenario for this stage has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   digest('SHIELD{placeholder_five}', 'sha256'),
   'Placeholder hint.', 40, 4),

  (6, 'stage-06', 'Challenge 06', 'Domain TBC', 'Hard', 400,
   'Placeholder summary for stage six. Replace with a one-line teaser.',
   'Placeholder briefing. The capstone scenario has not been written yet — this text exists so the page renders while the platform is built.',
   'Placeholder objective. Describe here what the participant has to discover or achieve.',
   digest('SHIELD{placeholder_six}', 'sha256'),
   'Placeholder hint.', 50, 5);
