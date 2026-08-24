import type { NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/dal";
import { getChallenge } from "@/lib/challenges";
import { getArtifact, readArtifact } from "@/lib/evidence";

/**
 * Hands over one stage's evidence file.
 *
 * A Route Handler rather than a static asset: the file lives under `data/`,
 * off the web root, so this is the only path to it and every request carries
 * the same two checks the page does — a real session, and the stage actually
 * unlocked for that agent. A `public/` file would be an unauthenticated URL
 * that anyone could pass around.
 *
 * The slug is read back out of the database rather than trusted, so it can
 * only ever name a published challenge, and the file it maps to comes from a
 * fixed table — nothing the caller sends reaches the filesystem.
 *
 * Unknown slug, locked stage and missing registry entry all return the same
 * 404, so probing the route tells an agent nothing about which stages exist.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/challenges/[slug]/evidence">,
) {
  const { slug } = await ctx.params;
  const agent = await requireUser();

  const challenge = await getChallenge(agent.id, slug);
  const artifact = challenge && getArtifact(challenge.slug);
  if (!challenge || !challenge.unlocked || !artifact) {
    return new Response("Not found", { status: 404 });
  }

  const body = await readArtifact(artifact);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": artifact.contentType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${artifact.name}"`,
      // Per-agent and gated, so it must not sit in a shared cache. The file
      // itself never changes, so the browser may keep its own copy.
      "Cache-Control": "private, max-age=3600",
      // Belt and braces on a route that serves an attacker-supplied-looking
      // file: never let a browser sniff its way to something executable.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
