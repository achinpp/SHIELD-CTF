import {
  ArchiveBanner,
  ArchiveProse,
  ArchiveTerminal,
} from "@/components/archive-terminal";
import { ArchiveReturn } from "@/components/archive-return";

/**
 * The archive's 403.
 *
 * Scoped to this segment rather than the app root on purpose: the copy is
 * in-world, and a platform-wide forbidden page should not be talking about
 * synchronization nodes. Next renders the nearest `forbidden` file to the
 * segment that called `forbidden()`, so this one covers the archive and
 * nothing else.
 *
 * It names no node number, no valid range and no parameter format. An agent
 * arrives here knowing only that the door exists and that it wants something —
 * which is precisely the state the incident page is there to resolve.
 */
export default function ArchiveForbidden() {
  return (
    <>
      <ArchiveReturn />

      <div className="mt-8">
        <ArchiveTerminal
          title="SHIELD // ARCHIVAL TRACE SUBSYSTEM"
          status="STATUS: RESTRICTED"
          tone="alert"
          secId="SEC-ID: TRACE-ERR-403"
        >
          <ArchiveBanner
            stamp="HTTP/1.1 403 FORBIDDEN"
            heading="ACCESS DENIED"
            meta={[
              {
                label: "SUBSYSTEM",
                value: "ARCHIVAL TRACE SUBSYSTEM",
              },
              { label: "STATUS", value: "RESTRICTED", tone: "alert" },
            ]}
          />

          <ArchiveProse>
            <p className="font-mono text-[13px] tracking-wide text-alert-soft">
              A valid synchronization node is required.
            </p>
            <p>
              Access to the internal trace repository is restricted to
              authorized archival synchronization nodes. Specify an authorized
              node parameter to continue.
            </p>
          </ArchiveProse>
        </ArchiveTerminal>
      </div>
    </>
  );
}
