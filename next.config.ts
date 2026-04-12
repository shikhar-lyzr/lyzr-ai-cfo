import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gitclaw"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
