import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits `.next/standalone` with a self-contained server.js and only the
  // traced node_modules, so the Docker runtime image carries no toolchain.
  output: "standalone",
  images: {
    // Next 16 only honours qualities declared here. The artwork is the whole
    // page, so the plates are served well above the default 75.
    qualities: [75, 90, 95],
  },
  // The floating dev badge sits right on top of the HUD's bottom-left corner.
  // Dev-only either way, but it makes the intro hard to review.
  devIndicators: false,
  experimental: {
    // Enables `forbidden()` and the `forbidden.tsx` convention, which is how
    // the stage-02 trace subsystem answers 403 with a rendered page instead of
    // a 200 that merely says "denied". Still flagged experimental upstream; if
    // it is ever dropped, the fallback is a route handler that server-renders
    // the same component, at the cost of the page's styling.
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        // Half of challenge 02's clue. It lives here because a Server
        // Component cannot set a response header, and the split across markup
        // and headers is the point of the stage — see the page's own comment.
        source: "/archive/incident.html",
        headers: [{ key: "X-Sync-Cluster", value: "JZHUIRJNGE3Q====" }],
      },
      {
        // Stage 02's KEYSTONE share, Base32 like everything else on this
        // node. Only the authorized trace response carries it: `has` values
        // are anchored regexes, so `?node=170` or `?node=1` never match. The
        // 403 for any other node stays silent, as the traces page intends.
        //
        // Config headers are applied before the proxy runs, so they also
        // land on its sign-in redirect. The cookie condition keeps the share
        // off that redirect for anonymous requests. It is the same optimistic
        // check as `src/proxy.ts` (presence, not validity), which is as far
        // as a config header can go. The cookie name is `SESSION_COOKIE`.
        source: "/archive/internal/traces",
        has: [
          { type: "query", key: "node", value: "17" },
          { type: "cookie", key: "shield_session" },
        ],
        headers: [
          {
            key: "X-Keystone",
            value: "JNJTELJRG42DON3CMM2GCOJRHEZWGMRZHAYGMZJZMRSDMODEGRSWGYZZMI======",
          },
        ],
      },
    ];
  },
  // Challenge artifacts are read at runtime from `process.cwd()`, so nothing
  // in the source imports them and file tracing has no way to discover them.
  // Naming the routes that read them puts the files in `.next/standalone`,
  // which is all the Docker runtime stage copies.
  outputFileTracingIncludes: {
    "/challenges/\\[slug\\]": ["data/challenges/**/*"],
    "/challenges/\\[slug\\]/evidence": ["data/challenges/**/*"],
    "/archive/internal/traces/old.log": ["data/challenges/stage-02/**/*"],
    "/archive/internal/traces/flag.txt": ["data/challenges/stage-02/**/*"],
  },
};

export default nextConfig;
