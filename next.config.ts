import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Next 16 dev only serves its client scripts to `localhost` by default.
  // Allow 127.0.0.1 too, for when another process holds localhost:3000 over IPv6.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
