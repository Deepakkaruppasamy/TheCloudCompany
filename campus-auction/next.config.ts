import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      allowedOrigins: [
        "thecloudcompany.onrender.com",
        "*.onrender.com",
        "localhost:3000",
        "localhost:10000",
      ],
    },
  },
};

export default nextConfig;
