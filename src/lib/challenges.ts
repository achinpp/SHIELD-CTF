import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cache } from "react";

import { sql } from "@/lib/db";
import { FLAG_PATTERN, type Challenge } from "@/lib/challenge-format";

/**
 * Challenge board data access.
 *
 * Flags never leave this module and are never sent to the browser — not in
 * props, not in a payload, not in a server-rendered attribute. The board only
 * ever learns whether a submission matched.
 *
 * `server-only` above enforces that. The shared type and the display format
 * live in `@/lib/challenge-format` so Client Components can import those
 * without pulling flag checking into the browser bundle.
 */

type Row = {
  id: string;
  stage: number;
  slug: string;
  title: string;
  domain: string;
  difficulty: Challenge["difficulty"];
  points: number;
  summary: string;
  scenario: string;
  task: string;
  intel_note: string | null;
  hint: string | null;
  hint_penalty: number;
  requires_stage: number | null;
  solved: boolean;
};

const SELECT_COLUMNS = sql`
  c.id, c.stage, c.slug, c.title, c.domain, c.difficulty, c.points,
  c.summary, c.scenario, c.task, c.intel_note, c.hint, c.hint_penalty,
  c.requires_stage,
  (s.user_id IS NOT NULL) AS solved
`;

function toChallenge(row: Row, unlocked: boolean): Challenge {
  return {
    id: row.id,
    stage: row.stage,
    slug: row.slug,
    title: row.title,
    domain: row.domain,
    difficulty: row.difficulty,
    points: row.points,
    summary: row.summary,
    scenario: row.scenario,
    task: row.task,
    intelNote: row.intel_note,
    hint: row.hint,
    hintPenalty: row.hint_penalty,
    requiresStage: row.requires_stage,
    solved: row.solved,
    unlocked,
  };
}

/** The board as one agent sees it, in stage order. */
export const getBoard = cache(async (userId: string): Promise<Challenge[]> => {
  const rows = await sql<Row[]>`
    SELECT ${SELECT_COLUMNS}
    FROM challenges c
    LEFT JOIN solves s ON s.challenge_id = c.id AND s.user_id = ${userId}
    WHERE c.published = true
    ORDER BY c.stage
  `;

  const solvedStages = new Set(rows.filter((r) => r.solved).map((r) => r.stage));

  return rows.map((r) =>
    toChallenge(r, r.requires_stage === null || solvedStages.has(r.requires_stage)),
  );
});

/**
 * A single challenge for its own page. Returns null when the slug is unknown
 * or unpublished, so the route can render a 404 rather than leak which slugs
 * exist behind the scenes.
 */
export const getChallenge = cache(
  async (userId: string, slug: string): Promise<Challenge | null> => {
    const [row] = await sql<Row[]>`
      SELECT ${SELECT_COLUMNS}
      FROM challenges c
      LEFT JOIN solves s ON s.challenge_id = c.id AND s.user_id = ${userId}
      WHERE c.slug = ${slug} AND c.published = true
    `;
    if (!row) return null;

    let unlocked = row.requires_stage === null;
    if (!unlocked) {
      const [met] = await sql`
        SELECT 1 FROM solves s
        JOIN challenges c ON c.id = s.challenge_id
        WHERE s.user_id = ${userId} AND c.stage = ${row.requires_stage}
      `;
      unlocked = Boolean(met);
    }

    return toChallenge(row, unlocked);
  },
);

export type Standing = {
  solved: number;
  total: number;
  score: number;
  possible: number;
};

export const getStanding = cache(async (userId: string): Promise<Standing> => {
  const [row] = await sql<
    { solved: number; total: number; score: number; possible: number }[]
  >`
    SELECT
      count(s.user_id)::int                                        AS solved,
      count(*)::int                                                AS total,
      coalesce(sum(c.points) FILTER (WHERE s.user_id IS NOT NULL), 0)::int AS score,
      coalesce(sum(c.points), 0)::int                              AS possible
    FROM challenges c
    LEFT JOIN solves s ON s.challenge_id = c.id AND s.user_id = ${userId}
    WHERE c.published = true
  `;
  return row;
});

export type SubmitOutcome =
  | { status: "correct"; points: number }
  | { status: "incorrect" }
  | { status: "already-solved" }
  | { status: "locked" }
  | { status: "malformed" }
  | { status: "throttled"; retryAfterSeconds: number };

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS_PER_WINDOW = 10;

/**
 * Check a submitted flag.
 *
 * The comparison is over SHA-256 digests with `timingSafeEqual`, so response
 * time cannot be used to recover a flag character by character the way a
 * short-circuiting `===` would allow.
 */
export async function submitFlag(
  userId: string,
  challengeId: string,
  submitted: string,
): Promise<SubmitOutcome> {
  const flag = submitted.trim();
  if (!FLAG_PATTERN.test(flag)) return { status: "malformed" };

  const [challenge] = await sql<
    {
      id: string;
      stage: number;
      points: number;
      flag_hash: Buffer;
      requires_stage: number | null;
    }[]
  >`
    SELECT id, stage, points, flag_hash, requires_stage
    FROM challenges
    WHERE id = ${challengeId} AND published = true
  `;
  if (!challenge) return { status: "malformed" };

  const [existing] = await sql`
    SELECT 1 FROM solves
    WHERE user_id = ${userId} AND challenge_id = ${challengeId}
  `;
  if (existing) return { status: "already-solved" };

  // Re-check the prerequisite server-side. The board greys locked stages out,
  // but a Server Action is reachable without ever rendering the board.
  if (challenge.requires_stage !== null) {
    const [met] = await sql`
      SELECT 1 FROM solves s
      JOIN challenges c ON c.id = s.challenge_id
      WHERE s.user_id = ${userId} AND c.stage = ${challenge.requires_stage}
    `;
    if (!met) return { status: "locked" };
  }

  const [recent] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM flag_attempts
    WHERE user_id = ${userId}
      AND attempted_at > now() - ${`${WINDOW_SECONDS} seconds`}::interval
  `;
  if (recent.n >= MAX_ATTEMPTS_PER_WINDOW) {
    return { status: "throttled", retryAfterSeconds: WINDOW_SECONDS };
  }

  const submittedHash = createHash("sha256").update(flag).digest();
  const storedHash = Buffer.from(challenge.flag_hash);
  const correct =
    submittedHash.length === storedHash.length &&
    timingSafeEqual(submittedHash, storedHash);

  await sql`
    INSERT INTO flag_attempts (user_id, challenge_id, correct)
    VALUES (${userId}, ${challengeId}, ${correct})
  `;

  if (!correct) return { status: "incorrect" };

  // ON CONFLICT guards the race where the same flag is submitted twice at once.
  await sql`
    INSERT INTO solves (user_id, challenge_id)
    VALUES (${userId}, ${challengeId})
    ON CONFLICT DO NOTHING
  `;

  return { status: "correct", points: challenge.points };
}
