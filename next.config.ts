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
