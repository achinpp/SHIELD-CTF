"use server";

import { requireUser } from "@/lib/auth/dal";
import { getChallenge } from "@/lib/challenges";
import { runShell } from "@/lib/workstation";
import { SHELL_HOME, type ShellResult } from "@/lib/workstation-format";

/**
 * One command against the stage-04 workstation image.
 *
 * A Server Action rather than a Route Handler, for the same reasons as the
 * stage-03 console in `@/app/actions/logs`: actions are dispatched one at a
 * time per client and carry the framework's Origin check and an encrypted
 * action id, so the terminal cannot be trivially fanned out or driven from
 * outside the browser.
 *
 * Neither of those is a security boundary, and nothing here treats them as
 * one. The real guarantee is that `runShell` cannot do anything: it reads a
 * frozen JSON tree and formats strings. There is no process to escape from.
 */

/** Longer than any legitimate command; stops a megabyte of junk being parsed. */
const MAX_INPUT = 200;

export async function shell(
  slug: string,
  cwd: string,
  input: string,
): Promise<ShellResult> {
  const user = await requireUser();

  // The image is part of the stage, so it is gated like the stage. Reading the
  // challenge back also validates the slug against the database rather than
  // trusting the one the client posted.
  const challenge = await getChallenge(user.id, slug);
  if (!challenge || !challenge.unlocked) {
    return {
      blocks: [
        {
          kind: "note",
          tone: "error",
          lines: ["evidence package not mounted for your clearance."],
        },
      ],
      cwd: SHELL_HOME,
    };
  }

  return runShell(String(cwd).slice(0, MAX_INPUT), String(input).slice(0, MAX_INPUT));
}
