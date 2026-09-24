import { readArchiveFile } from "@/lib/archive";
import { requireUser } from "@/lib/auth/dal";

/**
 * The recovery journal — the stage's actual material.
 *
 * Served as `text/plain` so it opens in the browser rather than downloading,
 * which is what an agent poking at a legacy host expects of a `.log`. The
 * fragments inside are encoded and deliberately shuffled; handing the file
 * over whole is the point, exactly as with the stage-06 and stage-07
 * artifacts. There is nothing to withhold here — decoding it *is* the work.
 *
 * `nosniff` because the body is attacker-adjacent fiction rather than anything
 * the browser should be guessing about, and the route is authenticated for the
 * same reason as the rest of `/archive`.
 */
export async function GET() {
  await requireUser();

  return new Response(await readArchiveFile("old.log"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
