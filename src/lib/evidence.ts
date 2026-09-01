import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Downloadable stage artifacts.
 *
 * The opposite call to the stage-03 log, and deliberately so. That record is
 * queryable but never released, because handing over the file is what made
 * the stage skippable. Stages 05 and 06 are steganography and cryptanalysis:
 * the work *is* the file, so there is nothing to withhold — an agent who
 * cannot open the image, or read the ciphertext, cannot start.
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
  "stage-05": {
    file: "stage-05/raven_recovered.png",
    name: "raven_recovered.png",
    contentType: "image/png",
    label: "PNG IMAGE // RECOVERED ARTIFACT",
    note: "1254 × 1254 · lossless · recovered intact from SHIELD-WKS-006",
  },
  // Stage 06 is handed over for the same reason as stage 05: the ciphertext
  // *is* the puzzle. Withholding it and answering queries over it, the way
  // stage 03's log is served, would withhold the only thing there is to work
  // on. Text/JSON rather than a binary, so nothing in the response path can
  // damage it — but it is still `application/json` with `nosniff`, never
  // something a browser would try to run.
  "stage-06": {
    file: "stage-06/lockstep_escrow.json",
    name: "lockstep_escrow.json",
    contentType: "application/json",
    label: "JSON INTERCEPT // KRAKEN RELAY MESH",
    note: "INTERCEPT-4471 · 48-relay roster, one escrow envelope, one sealed vault",
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
