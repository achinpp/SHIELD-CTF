import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FlagForm } from "@/components/flag-form";
import { requireUser } from "@/lib/auth/dal";
import { getChallenge } from "@/lib/challenges";
import type { Challenge } from "@/lib/challenge-format";

const DIFFICULTY_TONE: Record<Challenge["difficulty"], string> = {
  Easy: "border-signal/40 text-signal/70",
  Moderate: "border-amber-400/40 text-amber-300/80",
  Hard: "border-alert/50 text-alert-soft",
};

export async function generateMetadata({
  params,
}: PageProps<"/challenges/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const user = await requireUser();
  const challenge = await getChallenge(user.id, slug);
  return { title: challenge ? challenge.title : "Unknown Stage" };
}

/**
 * One challenge, on its own page.
 *
 * `requireUser()` runs before anything is read, and the locked check is
 * repeated here rather than trusted from the board — this page is reachable
 * by typing the URL, so the board greying a tile out proves nothing.
 */
export default async function ChallengePage({
  params,
}: PageProps<"/challenges/[slug]">) {
  const { slug } = await params;
  const agent = await requireUser();
  const challenge = await getChallenge(agent.id, slug);

  if (!challenge) notFound();
  // Send a locked stage back to the board rather than revealing its briefing.
  if (!challenge.unlocked) redirect("/challenges");

  return (
    <main className="relative min-h-dvh w-full bg-void">
      <div
        aria-hidden
        className="scanlines pointer-events-none fixed inset-0 z-10 opacity-20"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-10 vignette" />

      <div className="relative z-20 mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/challenges"
          className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-signal/45 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
        >
          <span aria-hidden>&lsaquo;</span> CHALLENGE BOARD
        </Link>

        <header className="mt-8 border-b border-signal/15 pb-8">
          <p className="font-mono text-[10px] tracking-[0.3em] text-signal/40">
            STAGE {String(challenge.stage).padStart(2, "0")}
            <span className="mx-2 text-signal/20">/</span>
            {challenge.domain.toUpperCase()}
          </p>

          <h1 className="mt-3 font-mono text-2xl font-semibold tracking-[0.2em] text-signal sm:text-3xl">
            {challenge.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`border px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] ${DIFFICULTY_TONE[challenge.difficulty]}`}
            >
              {challenge.difficulty.toUpperCase()}
            </span>
            <span className="border border-signal/25 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-signal/60">
              {challenge.points} PTS
            </span>
            {challenge.solved && (
              <span className="border border-signal/60 bg-signal/10 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-signal">
                ✓ CLEARED
              </span>
            )}
          </div>
        </header>

        <section className="mt-8">
          <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
            BRIEFING
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-signal/60">
            {challenge.scenario}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
            OBJECTIVE
          </h2>
          <p className="mt-3 font-mono text-[13px] leading-relaxed tracking-wide text-signal/75">
            {challenge.task}
          </p>
        </section>

        <section className="mt-10 border-t border-signal/15 pt-8">
          {challenge.solved ? (
            <div className="border border-signal/40 bg-signal/[0.06] p-6 text-center">
              <p className="font-mono text-[11px] tracking-[0.25em] text-signal">
                ✓ STAGE CLEARED
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-wide text-signal/45">
                {challenge.points} points recorded.
              </p>
              <Link
                href="/challenges"
                className="mt-6 inline-block font-mono text-[10px] tracking-[0.25em] text-signal/60 underline underline-offset-4 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                BACK TO BOARD
              </Link>
            </div>
          ) : (
            <FlagForm
              challengeId={challenge.id}
              hint={challenge.hint}
              hintPenalty={challenge.hintPenalty}
            />
          )}
        </section>
      </div>
    </main>
  );
}
