import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gitclaw"],
  transpilePackages: ["react-markdown"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./agent/**/*"],
  },
};

export default nextConfig;
