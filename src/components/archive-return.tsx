import Link from "next/link";

/**
 * The way back to the stage briefing.
 *
 * Platform chrome rather than part of the archive: it sits outside the
 * terminal window on purpose, so nothing inside the box is anything but the
 * box. Without it an agent who opens the target has no route back except the
 * browser's own history, which is a poor way to treat a page people will
 * bounce in and out of a dozen times while working the stage.
 */
export function ArchiveReturn() {
  return (
    <Link
      href="/challenges/stage-02"
      className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-signal/45 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
    >
      <span aria-hidden>&lsaquo;</span> STAGE 02 BRIEFING
    </Link>
  );
}
