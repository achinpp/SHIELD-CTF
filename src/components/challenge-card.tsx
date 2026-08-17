import Link from "next/link";

import type { Challenge } from "@/lib/challenge-format";

const DIFFICULTY_TONE: Record<Challenge["difficulty"], string> = {
  Easy: "border-signal/40 text-signal/70",
  Moderate: "border-amber-400/40 text-amber-300/80",
  Hard: "border-alert/50 text-alert-soft",
};

/** Corner brackets, matching the terminal chrome elsewhere. */
const CORNERS = [
  "left-0 top-0 border-l border-t",
  "right-0 top-0 border-r border-t",
  "left-0 bottom-0 border-l border-b",
  "right-0 bottom-0 border-r border-b",
] as const;

/**
 * A board tile. Everything interactive lives on the challenge's own page, so
 * this stays a Server Component and ships no JavaScript.
 *
 * A locked stage renders as a plain element rather than a link: there is
 * nothing to see yet, and the page itself refuses locked stages anyway.
 */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { solved, unlocked } = challenge;

  const shell = `group relative block border p-5 transition-colors sm:p-6 ${
    solved
      ? "border-signal/50 bg-signal/[0.06] hover:border-signal"
      : unlocked
        ? "border-signal/20 bg-hull/60 hover:border-signal/50 hover:bg-hull"
        : "cursor-not-allowed border-signal/10 bg-hull/30"
  }`;

  const inner = (
    <>
      {solved &&
        CORNERS.map((corner) => (
          <span
            key={corner}
            aria-hidden
            className={`pointer-events-none absolute size-3 border-signal/70 ${corner}`}
          />
        ))}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className={unlocked ? "" : "opacity-50"}>
          <p className="font-mono text-[10px] tracking-[0.3em] text-signal/40">
            STAGE {String(challenge.stage).padStart(2, "0")}
            <span className="mx-2 text-signal/20">/</span>
            {challenge.domain.toUpperCase()}
          </p>
          <h2 className="mt-2 font-mono text-base font-semibold tracking-[0.15em] text-signal sm:text-lg">
            {challenge.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`border px-2 py-1 font-mono text-[9px] tracking-[0.2em] ${DIFFICULTY_TONE[challenge.difficulty]}`}
          >
            {challenge.difficulty.toUpperCase()}
          </span>
          <span className="border border-signal/25 px-2 py-1 font-mono text-[9px] tracking-[0.2em] text-signal/60">
            {challenge.points} PTS
          </span>
        </div>
      </header>

      {unlocked ? (
        <p className="mt-4 text-sm leading-relaxed text-signal/50">
          {challenge.summary}
        </p>
      ) : (
        <p className="mt-4 font-mono text-[11px] leading-relaxed tracking-wide text-signal/35">
          SEALED &mdash; clear stage{" "}
          {String(challenge.requiresStage).padStart(2, "0")} to unlock.
        </p>
      )}

      <footer className="mt-5 flex items-center justify-between">
        {solved ? (
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-signal">
            <span aria-hidden>✓</span> CLEARED
          </span>
        ) : unlocked ? (
          <span className="font-mono text-[10px] tracking-[0.25em] text-signal/50">
            AWAITING SUBMISSION
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.25em] text-signal/25">
            LOCKED
          </span>
        )}

        {unlocked && (
          <span className="font-mono text-[10px] tracking-[0.25em] text-signal/60 transition-transform group-hover:translate-x-1">
            OPEN &rsaquo;
          </span>
        )}
      </footer>
    </>
  );

  if (!unlocked) {
    return (
      <div
        className={shell}
        aria-disabled
        aria-label={`Stage ${challenge.stage}: locked`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/challenges/${challenge.slug}`}
      className={`${shell} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal`}
      aria-label={`Stage ${challenge.stage}: ${challenge.title}`}
    >
      {inner}
    </Link>
  );
}
