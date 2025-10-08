/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: http:",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  async headers() {
    const baseHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin',
      },
    ];
    const security = isProd ? [{ key: 'Content-Security-Policy', value: csp }] : [];
    return [
      {
        source: '/:path*',
        headers: [...baseHeaders, ...security],
      },
    ];
  },
};

module.exports = nextConfig;
