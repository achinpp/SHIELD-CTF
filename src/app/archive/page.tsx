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
  title: "Secure Archive Node",
};

/**
 * The archive gateway — the front door, and deliberately a dead end.
 *
 * Everything on this page is flavour. There is no clue in the markup, no clue
 * in the headers and nothing hidden in the copy: an agent who only reads the
 * rendered page leaves with nothing. The one honest signal is the degraded
 * synchronisation status, which is there to suggest that the interesting part
 * of this host is whatever is no longer running properly.
 */
export default async function ArchiveGateway() {
  await requireUser();

  return (
    <>
      <ArchiveReturn />

      <div className="mt-8">
        <ArchiveTerminal
          title="SHIELD // SECURE ARCHIVE NODE"
          status="STATION: ONLINE"
          secId="ARCHIVE // TERMINAL READY"
        >
          <ArchiveBanner
            stamp="LEGACY OPERATIONS ARCHIVE"
            stampTone="signal"
            heading="SECURITY OPERATIONS ARCHIVE"
            meta={[
              { label: "NODE STATUS", value: "ONLINE", tone: "signal" },
              { label: "ARCHIVE STATUS", value: "DEGRADED", tone: "warn" },
              { label: "SYNCHRONIZATION", value: "PARTIAL", tone: "warn" },
            ]}
          />

          <ArchiveProse>
            <p>Welcome to the SHIELD legacy operations archive.</p>
            <p>
              This interface provides access to historical system records and
              synchronization data.
            </p>
            <p>Some archival subsystems may be unavailable or restricted.</p>
          </ArchiveProse>

          <ArchivePanel label="SYSTEM MESSAGE">
            <p className="text-[13px] leading-relaxed text-signal/50">
              Legacy synchronization services remain under investigation
              following a recent archival incident.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-signal/50">
              Unauthorized access attempts are logged.
            </p>
          </ArchivePanel>
        </ArchiveTerminal>
      </div>
    </>
  );
}
