/**
 * The parts of the challenge model that are safe in a browser bundle.
 *
 * Deliberately separate from `@/lib/challenges`, which is marked `server-only`
 * because it reads flag hashes and performs the comparison. A Client Component
 * importing a runtime value from that module would drag the whole thing —
 * flag checking included — into the client bundle. Keeping the shared shape
 * and the display format here means the guard can stay on.
 *
 * Nothing secret belongs in this file.
 */

export const FLAG_FORMAT = "SHIELD{...}";

/** Rejects obvious noise before it reaches a comparison. */
export const FLAG_PATTERN = /^SHIELD\{[\x20-\x7E]{1,120}\}$/;

export type Difficulty = "Easy" | "Moderate" | "Hard";

export type Challenge = {
  id: string;
  stage: number;
  slug: string;
  title: string;
  domain: string;
  difficulty: Difficulty;
  points: number;
  /** One-line teaser shown on the board card. */
  summary: string;
  /** Full text, shown only on the challenge's own page. */
  scenario: string;
  task: string;
  hint: string | null;
  hintPenalty: number;
  requiresStage: number | null;
  /** Solved by the agent viewing the board. */
  solved: boolean;
  /** False while the prerequisite stage is unsolved. */
  unlocked: boolean;
};
