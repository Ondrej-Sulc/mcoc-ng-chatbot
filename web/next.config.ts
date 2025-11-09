import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: '../',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['@cerebro/core'],
};

export default nextConfig;