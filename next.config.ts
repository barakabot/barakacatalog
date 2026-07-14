import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "http://192.168.1.24:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
};

export default nextConfig;
