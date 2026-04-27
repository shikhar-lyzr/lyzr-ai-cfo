import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gitclaw"],
  transpilePackages: ["react-markdown"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./agent/**/*"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
