import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import {
  ArchiveBanner,
  ArchivePanel,
  ArchiveTerminal,
} from "@/components/archive-terminal";
import { ArchiveReturn } from "@/components/archive-return";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Archival Trace Subsystem",
};

/**
 * The restricted trace subsystem — the door the stage is really about.
 *
 * Without the right node it answers 403 and says nothing else. That silence is
 * the design: the denied page names no node, no range and no format, so the
 * only way through is the clue split across the incident page's markup and its
 * response header. A 403 that hinted at its own answer would collapse the
 * stage to a two-minute guess.
 *
 * `forbidden()` is what produces a real 403 rather than a 200 that merely
 * looks unhappy — the status code is a signal an agent scanning this host is
 * entitled to read, and getting it wrong would mislead anyone working from
 * `curl -I`. It renders `forbidden.tsx` from the nearest segment that has one
 * and needs `experimental.authInterrupts` in `next.config.ts`.
 */

/**
 * The node the incident points at. Not a secret — it is recoverable from the
 * incident page by design, and an agent who brute-forces the eighteen values
 * in that page's search history is taking an intended shortcut, not cheating.
 */
const AUTHORIZED_NODE = "17";

export default async function TraceSubsystem({
  searchParams,
}: PageProps<"/archive/internal/traces">) {
  await requireUser();

  const { node } = await searchParams;
  // A repeated parameter arrives as an array; take the first rather than
  // rejecting it, so `?node=17&node=9` behaves like a careless request and
  // not like a different puzzle.
  const requested = (Array.isArray(node) ? node[0] : node)?.trim();

  if (requested !== AUTHORIZED_NODE) forbidden();

  return (
    <>
      <ArchiveReturn />

      <div className="mt-8">
        <ArchiveTerminal
          title="SHIELD // ARCHIVAL TRACE SUBSYSTEM"
          status="STATUS: AUTHORIZED"
          secId="STATUS: AUTHORIZED"
        >
          <ArchiveBanner
            stamp="ARCHIVE NODE 17 — AUTHORIZED"
            stampTone="signal"
            heading="LEGACY TRACE REPOSITORY UNLOCKED"
            meta={[
              { label: "NODE", value: "NODE-17", tone: "signal" },
              { label: "REPOSITORY", value: "LEGACY TRACE DATA" },
              { label: "STATUS", value: "AUTHORIZED", tone: "signal" },
            ]}
          />

          <ArchivePanel label="RECOVERY ARTIFACTS">
            <ul className="grid gap-2.5">
              <ArtifactLink
                href="/archive/internal/traces/old.log"
                name="old.log"
                note="ARCHIVAL FRAGMENT TRACE LOG"
              />
              <ArtifactLink
                href="/archive/internal/traces/flag.txt"
                name="flag.txt"
                note="ARCHIVAL RECOVERY NOTE"
              />
            </ul>
          </ArchivePanel>
        </ArchiveTerminal>
      </div>
    </>
  );
}

/**
 * A file in the repository. Plain `<a>` rather than `<Link>`: these are route
 * handlers serving text, not app routes, so there is nothing to prefetch and a
 * client-side navigation would be the wrong thing entirely.
 */
function ArtifactLink({
  href,
  name,
  note,
}: {
  href: string;
  name: string;
  note: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="group flex flex-wrap items-center justify-between gap-3 border border-signal/25 bg-hull/50 px-4 py-3 transition-colors hover:border-signal/60 hover:bg-signal/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <span className="font-mono text-[13px] tracking-wide text-signal">
          [ {name} ]
        </span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-signal/40 group-hover:text-signal/60">
          {note}
        </span>
      </a>
    </li>
  );
}
