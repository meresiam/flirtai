import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Avatar URLs em /desenrolos vêm de qualquer host que o usuário cole.
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
