import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 only honours qualities declared here. The artwork is the whole
    // page, so the plates are served well above the default 75.
    qualities: [75, 90, 95],
  },
  // The floating dev badge sits right on top of the HUD's bottom-left corner.
  // Dev-only either way, but it makes the intro hard to review.
  devIndicators: false,
};

export default nextConfig;
