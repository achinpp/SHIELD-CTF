"use client";

import { useActionState, useId, useState } from "react";

import { submit, type FlagState } from "@/app/actions/flag";
import { FLAG_FORMAT } from "@/lib/challenge-format";

/**
 * Flag submission for one challenge.
 *
 * The only interactive piece on the challenge page, so it is the only part
 * that needs to be a Client Component. It imports from `challenge-format`
 * rather than `@/lib/challenges` — the latter is `server-only` because it
 * holds the flag comparison, and importing a value from it here would drag
 * that into the browser bundle.
 */
export function FlagForm({
  challengeId,
  hint,
  hintPenalty,
}: {
  challengeId: string;
  hint: string | null;
  hintPenalty: number;
}) {
  const ids = useId();
  const [state, formAction, pending] = useActionState<FlagState, FormData>(
    submit,
    null,
  );
  const [hintShown, setHintShown] = useState(false);

  return (
    <div>
      {hint &&
        (hintShown ? (
          <p className="mb-6 border-l-2 border-amber-400/40 bg-amber-400/[0.04] py-3 pl-4 font-mono text-[12px] leading-relaxed text-amber-200/70">
            {hint}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setHintShown(true)}
            className="mb-6 font-mono text-[10px] tracking-[0.2em] text-signal/35 underline underline-offset-4 transition-colors hover:text-signal/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            REVEAL HINT{hintPenalty > 0 && ` (−${hintPenalty} PTS)`}
          </button>
        ))}

      <form action={formAction}>
        <input type="hidden" name="challengeId" value={challengeId} />
        <label
          htmlFor={`${ids}-flag`}
          className="block font-mono text-[10px] tracking-[0.25em] text-signal/50"
        >
          SUBMIT FLAG
        </label>

        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id={`${ids}-flag`}
            name="flag"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={pending}
            placeholder={FLAG_FORMAT}
            aria-invalid={state?.status === "error"}
            aria-describedby={`${ids}-result`}
            className="min-w-0 flex-1 border border-signal/25 bg-void/70 px-3 py-2.5 font-mono text-sm tracking-wide text-signal outline-none transition-colors placeholder:text-signal/20 focus:border-signal/70 focus:bg-signal/[0.04] aria-[invalid=true]:border-alert/60"
          />
          <button
            type="submit"
            disabled={pending}
            className="border border-signal/50 bg-signal/10 px-6 py-2.5 font-mono text-[10px] tracking-[0.25em] text-signal transition-colors hover:border-signal hover:bg-signal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "CHECKING" : "SUBMIT"}
          </button>
        </div>

        <p id={`${ids}-result`} aria-live="polite" className="mt-3 min-h-5">
          {state?.message && (
            <span
              className={`font-mono text-[11px] tracking-wide ${
                state.status === "correct" ? "text-signal" : "text-alert-soft"
              }`}
            >
              {state.message}
            </span>
          )}
        </p>
      </form>
    </div>
  );
}
