import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gitclaw"],
  transpilePackages: ["react-markdown"],
};

export default nextConfig;
