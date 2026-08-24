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
  // Challenge artifacts are read at runtime from `process.cwd()`, so nothing
  // in the source imports them and file tracing has no way to discover them.
  // Naming the route that reads them puts the files in `.next/standalone`,
  // which is all the Docker runtime stage copies.
  outputFileTracingIncludes: {
    "/challenges/\\[slug\\]": ["data/challenges/**/*"],
    "/challenges/\\[slug\\]/evidence": ["data/challenges/**/*"],
  },
};

export default nextConfig;
