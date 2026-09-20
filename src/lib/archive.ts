import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Files the stage-02 archive serves out of its trace repository.
 *
 * They live under `data/` rather than `public/` for the same reason the
 * stage-03 log does: a file under `public/` is a permanent, unauthenticated
 * URL that works for anyone who is ever given it, forever. These are reached
 * only through the route handlers beneath `/archive/internal/traces`, which
 * re-check the session on every request.
 *
 * That is a platform decision, not a puzzle one. Inside the fiction the
 * archive hands these over freely to any request carrying the right node —
 * and it still does. The session check is the outer perimeter that keeps the
 * stage's material off the open internet, not a second lock on the stage.
 *
 * Root kept as a literal for the same reason as in `@/lib/evidence`: the build
 * traces filesystem access statically, and a `path.join` it cannot resolve
 * makes it trace the whole project into the server bundle.
 */
const ARCHIVE_FILES = "data/challenges/stage-02";

export type ArchiveFile = "old.log" | "flag.txt";

export async function readArchiveFile(name: ArchiveFile): Promise<string> {
  return readFile(path.join(process.cwd(), ARCHIVE_FILES, name), "utf8");
}
