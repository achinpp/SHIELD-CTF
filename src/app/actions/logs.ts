"use server";

import { requireUser } from "@/lib/auth/dal";
import { getChallenge } from "@/lib/challenges";
import { runCommand } from "@/lib/log-console";
import type { ConsoleResult } from "@/lib/log-console-format";

/**
 * One command against a stage's log console.
 *
 * A Server Action rather than a Route Handler, despite this being a read.
 * Two reasons, both about the thing the console is defending:
 *
 *   - Next dispatches actions one at a time per client, so the console cannot
 *     be fanned out into parallel requests from the page it lives on.
 *   - Actions carry a framework Origin/Host check and an encrypted action id,
 *     which makes a scripted drain from outside the browser a deliberate act
 *     rather than a `curl` against a guessable `/api/logs?offset=`.
 *
 * Neither is a security boundary and neither is treated as one — the caps in
 * `runCommand` do the actual work, and the checks below re-establish who is
 * asking, because an action is a public POST endpoint like any other.
 */

/** Longer than any legitimate command; stops a megabyte of junk being parsed. */
const MAX_INPUT = 200;

export async function query(slug: string, input: string): Promise<ConsoleResult> {
  const user = await requireUser();

  // The console is part of the stage, so it is gated like the stage: an
  // unsolved prerequisite means no access to the evidence either. Reading the
  // challenge back also validates the slug against the database rather than
  // trusting the one the client posted.
  const challenge = await getChallenge(user.id, slug);
  if (!challenge || !challenge.unlocked) {
    return {
      blocks: [
        {
          kind: "note",
          tone: "error",
          lines: ["access denied — this record is not mounted for your clearance."],
        },
      ],
      budgetLeft: 0,
    };
  }

  return runCommand(user.id, challenge.slug, String(input).slice(0, MAX_INPUT));
}
