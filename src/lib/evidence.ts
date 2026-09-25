import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Downloadable stage artifacts.
 *
 * The opposite call to the stage-03 log, and deliberately so. That record is
 * queryable but never released, because handing over the file is what made
 * the stage skippable. The stages here — the case file, the disk image, the
 * photograph, the intercept and the capsule — are ones where the work *is*
 * the file, so there is nothing to withhold: an agent who cannot open it
 * cannot start.
 *
 * What is still worth defending is who gets it. The file sits under `data/`
 * rather than `public/`, so no static path serves it; the only way out is the
 * route handler at `/challenges/[slug]/evidence`, which re-checks the session
 * and the stage gate on every request. A file under `public/` would be a
 * permanent unauthenticated URL, shareable to anyone, forever.
 *
 * Root kept as a literal for the same reason as in `@/lib/log-console`: the
 * build traces filesystem access statically, and a `path.join` it cannot
 * resolve makes it trace the whole project into the server bundle.
 */
const ARTIFACTS = "data/challenges";

export type Artifact = {
  /** Path under ARTIFACTS. */
  file: string;
  /** Filename the browser saves it as. */
  name: string;
  contentType: string;
  /** Shown under the filename on the challenge page. */
  label: string;
  /** Standing line above the download card. */
  note: string;
};

/** A slug with no entry has no evidence download. */
const ARTIFACTS_BY_SLUG: Record<string, Artifact> = {
  // Stage 01's case file is three pieces — the case record, a photograph and a
  // recovered note — handed over as one ZIP, the way the report describes it.
  // The ZIP is only the starting point: the trail it opens runs out onto
  // public GitHub and X accounts, which this repository cannot hold.
  "stage-01": {
    file: "stage-01/KRAKEN-0017_case_file.zip",
    name: "KRAKEN-0017_case_file.zip",
    contentType: "application/zip",
    label: "ZIP ARCHIVE // CASE FILE KRAKEN-0017",
    note: "case record · recovered photograph · recovered note",
  },
  // Stage 05 is a disk image like stage 04's, but it is handed over whole
  // instead of walked through a simulated shell. Stage 04 is read from the
  // live file tree; this one is about what is no longer in it — deleted
  // directory entries, freed inodes, unallocated blocks — and only the raw
  // image carries those. It is a bare ext4 filesystem, for Autopsy or The
  // Sleuth Kit.
  "stage-05": {
    file: "stage-05/safehouse.img",
    name: "safehouse.img",
    contentType: "application/octet-stream",
    label: "RAW DISK IMAGE // KRAKEN SAFEHOUSE, WASHINGTON",
    note: "ext4 · 16 MiB · bit-for-bit acquisition · open it read-only",
  },
  "stage-06": {
    file: "stage-06/raven_recovered.png",
    name: "raven_recovered.png",
    contentType: "image/png",
    label: "PNG IMAGE // RECOVERED ARTIFACT",
    note: "1254 × 1254 · lossless · recovered intact from SHIELD-WKS-006",
  },
  // Stage 07 is handed over for the same reason as stage 06: the intercepted
  // traffic *is* the puzzle. Withholding it and answering queries over it, the
  // way stage 03's log is served, would withhold the only thing there is to
  // work on. Text/JSON rather than a binary, so nothing in the response path
  // can damage it — but it is still `application/json` with `nosniff`, never
  // something a browser would try to run.
  "stage-07": {
    file: "stage-07/lockstep_intercept.json",
    name: "lockstep_intercept.json",
    contentType: "application/json",
    label: "JSON INTERCEPT // KRAKEN RELAY MESH",
    note: "INTERCEPT-4471 · 72 transmissions · 48 stations · 1800–0600",
  },
  // Stage 08's capsule is only half the stage: it is encrypted under a key
  // split 7-of-7 across stages 01-07, so handing it over gives nothing away
  // to an agent who has not collected every share. Served as JSON with
  // `nosniff`, like stage 07.
  "stage-08": {
    file: "stage-08/keystone.capsule",
    name: "keystone.capsule",
    contentType: "application/json",
    label: "SEALED CAPSULE // SEIZED FROM NODE-17",
    note: "KRAKEN-CAPSULE · 7 cells · A256GCM · opens at full strength or not at all",
  },
};

export function getArtifact(slug: string): Artifact | null {
  return ARTIFACTS_BY_SLUG[slug] ?? null;
}

function resolve(artifact: Artifact): string {
  return path.join(process.cwd(), ARTIFACTS, artifact.file);
}

export async function readArtifact(artifact: Artifact): Promise<Buffer> {
  return readFile(resolve(artifact));
}

/** Size in bytes, for the download card. Null if the file is missing. */
export async function artifactSize(artifact: Artifact): Promise<number | null> {
  try {
    return (await stat(resolve(artifact))).size;
  } catch {
    return null;
  }
}
