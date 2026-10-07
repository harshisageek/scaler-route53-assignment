import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Cloudscape ships untranspiled ESM; Next has to compile it like app code.
  transpilePackages: [
    '@cloudscape-design/components',
    '@cloudscape-design/component-toolkit',
  ],

  /**
   * Proxy every /api/* call to FastAPI so the browser only ever talks to this
   * origin. That keeps the session cookie first-party and removes the need for
   * any CORS configuration in production.
   */
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/openapi.json', destination: `${backendUrl}/openapi.json` },
    ];
  },
};

export default nextConfig;
