import type { Metadata } from "next";

import { logout } from "@/app/actions/auth";
import { ChallengeCard } from "@/components/challenge-card";
import { requireUser } from "@/lib/auth/dal";
import { getBoard, getStanding } from "@/lib/challenges";

export const metadata: Metadata = {
  title: "Challenge Board",
};

/**
 * The challenge board — where an authenticated agent lands.
 *
 * `requireUser()` is the access check that counts; it resolves the session
 * against the database on every request. Flags are never fetched here, so
 * none can leak into the payload sent to the browser.
 */
export default async function Challenges() {
  const agent = await requireUser();
  const [board, standing] = await Promise.all([
    getBoard(agent.id),
    getStanding(agent.id),
  ]);

  const progress =
    standing.possible > 0
      ? Math.round((standing.score / standing.possible) * 100)
      : 0;

  return (
    <main className="relative min-h-dvh w-full overflow-y-auto bg-void">
      <div
        aria-hidden
        className="scanlines pointer-events-none fixed inset-0 z-10 opacity-20"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-10 vignette" />

      <div className="relative z-20 mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="border-b border-signal/15 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-alert">
                CLEARANCE LEVEL 7 &mdash; VERIFIED
              </p>
              <h1 className="mt-3 font-mono text-2xl font-semibold tracking-[0.2em] text-signal sm:text-3xl">
                CHALLENGE BOARD
              </h1>
              <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-signal/45">
                AGENT <span className="text-signal">{agent.codename}</span>
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="border border-signal/30 px-5 py-2 font-mono text-[10px] tracking-[0.25em] text-signal/70 transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                END SESSION
              </button>
            </form>
          </div>

          {/* Standing */}
          <div className="mt-8 grid grid-cols-2 gap-px border border-signal/15 bg-signal/10 sm:grid-cols-4">
            <Stat label="CLEARED" value={`${standing.solved} / ${standing.total}`} />
            <Stat label="SCORE" value={String(standing.score)} />
            <Stat label="AVAILABLE" value={String(standing.possible)} />
            <Stat label="PROGRESS" value={`${progress}%`} />
          </div>

          <div
            className="mt-px h-1 w-full bg-signal/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Operation progress"
          >
            <div
              className="h-full bg-signal transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        {board.length === 0 ? (
          <p className="mt-12 font-mono text-sm tracking-wide text-signal/50">
            No stages provisioned yet.
          </p>
        ) : (
          <div className="mt-10 grid gap-5">
            {board.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}

        <p className="mt-12 border-t border-signal/10 pt-6 text-center font-mono text-[10px] leading-relaxed tracking-[0.2em] text-signal/25">
          FLAGS TAKE THE FORM SHIELD&#123;...&#125; &mdash; SUBMISSIONS ARE LOGGED
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-void px-4 py-4">
      <p className="font-mono text-[9px] tracking-[0.25em] text-signal/35">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-lg font-semibold tracking-[0.1em] text-signal">
        {value}
      </p>
    </div>
  );
}
