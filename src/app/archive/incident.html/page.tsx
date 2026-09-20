import type { Metadata } from "next";

import {
  ArchiveBanner,
  ArchivePanel,
  ArchiveProse,
  ArchiveTerminal,
} from "@/components/archive-terminal";
import { ArchiveReturn } from "@/components/archive-return";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Incident Archive",
};

/**
 * The quarantined incident report.
 *
 * Carries the first half of the stage's clue. The second half is the
 * `X-Sync-Cluster` response header, attached in `next.config.ts` rather than
 * here — a Server Component cannot set a response header, and splitting the
 * clue across the markup and the headers is deliberate: it is what stops the
 * stage from falling to view-source alone, or to `curl -I` alone.
 *
 * Note the route segment is literally `incident.html`. The extension is part
 * of the fiction — a legacy host serving flat files — and Next is happy to
 * treat a dotted folder name as an ordinary segment.
 */

/** Legacy synchronisation queries, as the archive recorded them. */
const SEARCH_HISTORY = [
  { date: "2026-09-01", kind: "QUERY", node: 6 },
  { date: "2026-09-01", kind: "TRACE", node: 12 },
  { date: "2026-09-02", kind: "SYNC", node: 4 },
  { date: "2026-09-03", kind: "TRACE", node: 9 },
  { date: "2026-09-04", kind: "QUERY", node: 16 },
  { date: "2026-09-05", kind: "TRACE", node: 5 },
  { date: "2026-09-06", kind: "SYNC", node: 11 },
  { date: "2026-09-07", kind: "TRACE", node: 17 },
  { date: "2026-09-08", kind: "QUERY", node: 8 },
  { date: "2026-09-09", kind: "TRACE", node: 3 },
  { date: "2026-09-10", kind: "SYNC", node: 14 },
  { date: "2026-09-11", kind: "QUERY", node: 10 },
  { date: "2026-09-12", kind: "TRACE", node: 7 },
  { date: "2026-09-13", kind: "QUERY", node: 12 },
  { date: "2026-09-14", kind: "TRACE", node: 6 },
  { date: "2026-09-15", kind: "SYNC", node: 4 },
  { date: "2026-09-16", kind: "TRACE", node: 9 },
  { date: "2026-09-17", kind: "QUERY", node: 8 },
] as const;

/**
 * A genuine HTML comment, which JSX has no syntax for — `{/* … *​/}` is a
 * JavaScript comment and never reaches the document. The stage depends on
 * this being visible in view-source, so it is injected as raw markup.
 *
 * Safe despite the name: the string is a constant defined here, with no
 * interpolation and nothing derived from a request, a database row or a user.
 */
const METADATA_COMMENT = {
  __html:
    "\n    <!-- legacy synchronization metadata -->\n" +
    "    <!-- IFTGMZLDORSWIIDTPFXGG2DSN5XGS6TBORUW63RANZXWIZJANFZSA=== -->\n  ",
};

export default async function IncidentReport() {
  await requireUser();

  return (
    <>
      <ArchiveReturn />

      <div className="mt-8">
        <ArchiveTerminal
          title="SHIELD // INCIDENT ARCHIVE"
          status="STATUS: QUARANTINED"
          tone="alert"
          secId="SEC-ID: INC-882-SYNC"
        >
          <ArchiveBanner
            stamp="INCIDENT REPORT // 2026-09-17"
            heading="INCIDENT: LEGACY SYNCHRONIZATION FAILURE"
            meta={[
              {
                label: "INCIDENT",
                value: "Legacy Synchronization Failure",
              },
              { label: "STATUS", value: "QUARANTINED", tone: "alert" },
              {
                label: "INVESTIGATION",
                value: "ACTIVE // PRIORITY 1",
                tone: "warn",
              },
            ]}
          />

          <div aria-hidden dangerouslySetInnerHTML={METADATA_COMMENT} />

          <ArchiveProse>
            <p>
              System audit logs captured anomalous synchronization queries
              targeting retired archive nodes prior to session isolation.
              Diagnostic routing tables diverted active queries to diagnostic
              buffers.
            </p>
            <p>
              Historical trace logs have been locked pending security
              verification.
            </p>
          </ArchiveProse>

          <ArchivePanel label="ARCHIVAL SEARCH HISTORY">
            <p className="font-mono text-[10px] tracking-[0.18em] text-signal/35">
              RECENT LEGACY SYNCHRONIZATION ACTIVITY
            </p>

            <ul className="mt-3.5 grid gap-1">
              {SEARCH_HISTORY.map((row, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 font-mono text-[11px] tracking-wide text-signal/55"
                >
                  <span className="text-signal/30">{row.date}</span>
                  <span className="min-w-[3.5rem] text-signal/45">
                    {row.kind}
                  </span>
                  <span className="text-signal/70">
                    GET /?node={row.node}
                  </span>
                </li>
              ))}
            </ul>
          </ArchivePanel>
        </ArchiveTerminal>
      </div>
    </>
  );
}
