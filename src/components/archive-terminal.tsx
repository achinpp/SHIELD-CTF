import type { ReactNode } from "react";

/**
 * Chrome for the stage-02 archive node.
 *
 * The archive is in-world a *different* machine from the platform — an old
 * host SHIELD never decommissioned — so it needs to read as its own system
 * while still being unmistakably part of this site. It borrows the platform's
 * palette, mono type and corner-bracket treatment, and departs from it in the
 * one way a legacy box should: a boxed terminal window with a status bar and a
 * departmental footer, rather than the open, full-bleed layout the briefing
 * pages use.
 *
 * Everything here is presentational. Nothing in this file knows what the
 * challenge is, and no component takes a value that could leak an answer.
 */

/** Status colouring. `alert` for denied/quarantined, `signal` for nominal. */
export type Tone = "signal" | "alert" | "warn";

const TONE_TEXT: Record<Tone, string> = {
  signal: "text-signal",
  alert: "text-alert",
  warn: "text-amber-300/90",
};

const TONE_BORDER: Record<Tone, string> = {
  signal: "border-signal/50",
  alert: "border-alert/60",
  warn: "border-amber-400/50",
};

const CORNERS = [
  "left-0 top-0 border-l border-t",
  "right-0 top-0 border-r border-t",
  "left-0 bottom-0 border-l border-b",
  "right-0 bottom-0 border-r border-b",
] as const;

/**
 * The terminal window itself: title bar, body, departmental footer.
 *
 * `secId` is the reference printed bottom-right — the small piece of
 * bureaucracy that sells the box as a real system of record.
 */
export function ArchiveTerminal({
  title,
  status,
  tone = "signal",
  secId,
  children,
}: {
  title: string;
  status: string;
  tone?: Tone;
  secId: string;
  children: ReactNode;
}) {
  return (
    <div className="relative border border-signal/25 bg-hull/50">
      <div
        aria-hidden
        className="scanlines pointer-events-none absolute inset-0 opacity-15"
      />
      {CORNERS.map((corner) => (
        <span
          key={corner}
          aria-hidden
          className={`pointer-events-none absolute size-4 border-signal/50 ${corner}`}
        />
      ))}

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-signal/20 px-5 py-3 sm:px-7">
        <p className="font-mono text-[10px] tracking-[0.25em] text-signal/70">
          {title}
        </p>
        <span
          className={`border px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] ${TONE_BORDER[tone]} ${TONE_TEXT[tone]}`}
        >
          {status}
        </span>
      </div>

      <div className="relative px-5 py-7 sm:px-7 sm:py-9">{children}</div>

      <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-signal/15 px-5 py-3 font-mono text-[9px] tracking-[0.18em] text-signal/25 sm:px-7">
        <span>
          STRATEGIC HOMELAND INTERVENTION, ENFORCEMENT AND LOGISTICS DIVISION
        </span>
        <span>{secId}</span>
      </div>
    </div>
  );
}

/** Stamped classification line, heading and the key/value block beneath it. */
export function ArchiveBanner({
  stamp,
  stampTone = "alert",
  heading,
  meta,
}: {
  stamp: string;
  stampTone?: Tone;
  heading: string;
  meta: { label: string; value: string; tone?: Tone }[];
}) {
  return (
    <header>
      <span
        className={`inline-block border px-2.5 py-1 font-mono text-[9px] tracking-[0.25em] ${TONE_BORDER[stampTone]} ${TONE_TEXT[stampTone]}`}
      >
        {stamp}
      </span>

      <h1 className="mt-5 font-mono text-xl font-semibold tracking-[0.2em] text-signal sm:text-2xl">
        {heading}
      </h1>

      <dl className="mt-5 grid gap-1.5">
        {meta.map((row) => (
          <div key={row.label} className="flex flex-wrap gap-x-3 gap-y-0.5">
            <dt className="min-w-[10.5rem] font-mono text-[10px] tracking-[0.2em] text-signal/35">
              {row.label}
            </dt>
            <dd
              className={`font-mono text-[10px] tracking-[0.2em] ${
                row.tone ? TONE_TEXT[row.tone] : "text-signal/75"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** An inset block inside the terminal body, with a small caption above it. */
export function ArchivePanel({
  label,
  tone = "warn",
  children,
}: {
  label: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <section className="mt-7 border border-signal/20 bg-void/50 p-5">
      <p
        className={`font-mono text-[10px] font-semibold tracking-[0.25em] ${TONE_TEXT[tone]}`}
      >
        {label}
      </p>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** Body copy, matching the weight of the briefing pages. */
export function ArchiveProse({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 space-y-3 text-sm leading-relaxed text-signal/60">
      {children}
    </div>
  );
}
