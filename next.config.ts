import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load yahoo-finance2 from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["yahoo-finance2"],
};

export default nextConfig;
