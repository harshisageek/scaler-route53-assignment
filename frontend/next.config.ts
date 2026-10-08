import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000';
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "connect-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Cloudscape ships untranspiled ESM; Next has to compile it like app code.
  transpilePackages: [
    '@cloudscape-design/components',
    '@cloudscape-design/component-toolkit',
  ],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=()',
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },

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
