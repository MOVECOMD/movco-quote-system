import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'benkench.com' }],
        destination: '/api/sites/benkench',
        permanent: false,
      },
      {
        source: '/',
        has: [{ type: 'host', value: 'www.benkench.com' }],
        destination: '/api/sites/benkench',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
