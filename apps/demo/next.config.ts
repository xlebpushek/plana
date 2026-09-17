import type { NextConfig } from "next";

const basePath = process.env.GITHUB_PAGES === "1" ? "/plana" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  transpilePackages: ["@plana/core", "@plana/react"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
