"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/dal";
import { submitFlag } from "@/lib/challenges";

export type FlagState = {
  status: "idle" | "correct" | "error";
  message?: string;
} | null;

/**
 * Flag submission.
 *
 * Like every Server Action this is a public endpoint, so it re-establishes
 * who is calling rather than trusting anything the form sends. The challenge
 * id arrives from the client and is validated against the database inside
 * `submitFlag` — an agent cannot claim a stage by posting someone else's id,
 * because the prerequisite and solve checks run server-side.
 */
export async function submit(
  _prev: FlagState,
  formData: FormData,
): Promise<FlagState> {
  const user = await requireUser();

  const challengeId = String(formData.get("challengeId") ?? "");
  const flag = String(formData.get("flag") ?? "");

  const outcome = await submitFlag(user.id, challengeId, flag);

  switch (outcome.status) {
    case "correct":
      // Refresh the board so the stage flips to solved and the score moves,
      // and the challenge pages so this one shows as cleared and the next
      // one stops being locked.
      revalidatePath("/challenges");
      revalidatePath("/challenges/[slug]", "page");
      return {
        status: "correct",
        message: `Flag accepted. +${outcome.points} points.`,
      };
    case "incorrect":
      return { status: "error", message: "Flag rejected." };
    case "already-solved":
      return { status: "error", message: "You have already cleared this stage." };
    case "locked":
      return { status: "error", message: "Clear the previous stage first." };
    case "malformed":
      return { status: "error", message: "Flags look like SHIELD{...}." };
    case "throttled":
      return {
        status: "error",
        message: `Too many submissions. Wait ${outcome.retryAfterSeconds} seconds.`,
      };
  }
}
