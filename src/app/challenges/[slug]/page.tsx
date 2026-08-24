import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import challengeThree from "@/assets/challenges/challenge-03.png";
import challengeFive from "@/assets/challenges/challenge-05.png";
import { FlagForm } from "@/components/flag-form";
import { LogConsole } from "@/components/log-console";
import { requireUser } from "@/lib/auth/dal";
import { getChallenge } from "@/lib/challenges";
import type { Challenge } from "@/lib/challenge-format";
import { artifactSize, getArtifact } from "@/lib/evidence";

/** Blank line separates paragraphs; single newlines are soft wraps. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** One item per non-empty line. */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Bytes as the file browser would show them, for the download card. */
function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Optional key art, by slug. A stage without an entry renders text only, so
 * artwork can arrive one stage at a time without touching the layout.
 */
const STAGE_ART: Record<
  string,
  {
    src: StaticImageData;
    alt: string;
    /**
     * Present the source exactly as authored: original bytes, whole frame.
     *
     * Off by default, because the default is the better deal for a large
     * square plate — stage 03 ships a 1587px, 2.5 MB PNG that the optimiser
     * turns into a fraction of that in WebP, and cropping it to 3:2 keeps the
     * briefing above the fold on a phone.
     *
     * Neither applies to a piece of key art that was drawn at its final size.
     * Stage 05 is 456x645 portrait: the crop threw most of the raven away, and
     * re-encoding a 540 KB PNG buys little. `unoptimized` skips `/_next/image`
     * entirely, so the browser gets the PNG byte for byte instead of a WebP
     * transcode.
     */
    verbatim?: boolean;
  }
> = {
  "stage-03": {
    src: challengeThree,
    alt: "A hooded figure hunched over a keyboard, ringed by monitors scrolling with log output.",
  },
  "stage-05": {
    src: challengeFive,
    alt: "A raven in flight, wings spread against a storm split by forks of lightning.",
    verbatim: true,
  },
};

/**
 * Standing line above a stage's evidence terminal, by slug.
 *
 * A stage with an entry here renders the console; one without renders no
 * EVIDENCE section at all, so a new stage opts in by adding a line.
 *
 * There is no download counterpart any more. The log used to be a static file
 * under `public/`, which made the intended work — write something that reads
 * 4,678 lines and finds the one client that does not belong — skippable by
 * handing the file to a model. It now lives under `data/`, off the web root,
 * and this terminal is the only way to read it.
 */
const STAGE_EVIDENCE: Record<string, string> = {
  "stage-03":
    "4,678 requests · combined log format · queryable, not exportable",
};

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

  const art = STAGE_ART[challenge.slug];
  const evidence = STAGE_EVIDENCE[challenge.slug];
  // Stage 05 hands its artifact over instead of querying it — the file is the
  // puzzle there, so there is nothing to hold back. It is still served by a
  // gated route rather than from `public/`; see `@/lib/evidence`.
  const artifact = getArtifact(challenge.slug);
  const artifactBytes = artifact ? await artifactSize(artifact) : null;

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

        {art && (
          <div className="mt-8 overflow-hidden border border-signal/15">
            <Image
              src={art.src}
              alt={art.alt}
              placeholder="blur"
              // Skips `/_next/image`, so the file is served as authored rather
              // than transcoded to WebP.
              unoptimized={art.verbatim}
              sizes="(min-width: 768px) 42rem, 100vw"
              className={
                art.verbatim
                  ? // Whole frame, letterboxed on the void. Capped at the
                    // source's own width so it is never upscaled past it.
                    "mx-auto h-auto w-full max-w-[456px]"
                  : // Square source, cropped to a wide plate so the briefing
                    // still sits above the fold on a phone.
                    "aspect-[3/2] w-full object-cover object-center opacity-85"
              }
            />
          </div>
        )}

        <section className="mt-8">
          <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
            BRIEFING
          </h2>
          {/* Blank lines in the copy become paragraph breaks. */}
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-signal/60">
            {splitParagraphs(challenge.scenario).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
            OBJECTIVES
          </h2>
          {/* One objective per line in the data; a single line stays a
              sentence rather than becoming a one-item list. */}
          {splitLines(challenge.task).length > 1 ? (
            <ul className="mt-3 space-y-2">
              {splitLines(challenge.task).map((line, i) => (
                <li
                  key={i}
                  className="flex gap-3 font-mono text-[13px] leading-relaxed tracking-wide text-signal/75"
                >
                  <span aria-hidden className="text-signal/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-mono text-[13px] leading-relaxed tracking-wide text-signal/75">
              {challenge.task}
            </p>
          )}
        </section>

        {evidence && (
          <section className="mt-8">
            <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
              EVIDENCE
            </h2>
            <p className="mt-3 font-mono text-[10px] tracking-[0.15em] text-signal/40">
              {evidence}
            </p>
            <LogConsole slug={challenge.slug} />
          </section>
        )}

        {artifact && (
          <section className="mt-8">
            <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
              RECOVERED EVIDENCE
            </h2>
            <p className="mt-3 font-mono text-[10px] tracking-[0.15em] text-signal/40">
              {artifact.note}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 border border-signal/25 bg-hull/60 p-5">
              <span
                aria-hidden
                className="flex h-14 w-11 shrink-0 items-center justify-center border border-signal/35 font-mono text-[9px] tracking-[0.15em] text-signal/70"
              >
                {artifact.name.split(".").pop()?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px] tracking-wide text-signal">
                  {artifact.name}
                </p>
                <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-signal/40">
                  {artifact.label}
                  {artifactBytes !== null && ` · ${formatSize(artifactBytes)}`}
                </p>
              </div>
              {/* Served by the gated route handler, not from `public/`. */}
              <a
                href={`/challenges/${challenge.slug}/evidence`}
                download={artifact.name}
                className="border border-signal/40 px-4 py-2.5 font-mono text-[9px] tracking-[0.25em] text-signal transition-colors hover:border-signal hover:bg-signal/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                DOWNLOAD EVIDENCE
              </a>
            </div>
          </section>
        )}

        {challenge.intelNote && (
          <section className="mt-8">
            <h2 className="font-mono text-[10px] tracking-[0.25em] text-signal/40">
              S.H.I.E.L.D. INTELLIGENCE NOTE
            </h2>
            <blockquote className="mt-3 border-l-2 border-alert/40 bg-alert/[0.03] py-3 pl-4 text-sm italic leading-relaxed text-signal/55">
              &ldquo;{challenge.intelNote}&rdquo;
            </blockquote>
          </section>
        )}

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
