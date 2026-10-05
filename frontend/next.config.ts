import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "thumb.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "wsrv.nl",
      },
      {
        protocol: "https",
        hostname: "images.weserv.nl",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
