import { readArchiveFile } from "@/lib/archive";
import { requireUser } from "@/lib/auth/dal";

/**
 * The recovery note. Named `flag.txt` and containing no flag, which is the
 * joke and also the lesson: the reflex of grabbing anything called `flag.txt`
 * costs an agent a minute here rather than handing them the stage.
 */
export async function GET() {
  await requireUser();

  return new Response(await readArchiveFile("flag.txt"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
