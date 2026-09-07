/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backendUrl) {
      // Strip trailing slash if present
      const cleanUrl = backendUrl.replace(/\/+$/, '');
      return {
        beforeFiles: [
          {
            source: '/api/:path*',
            destination: `${cleanUrl}/api/:path*`,
          },
        ],
      };
    }
    return [];
  },
};

module.exports = nextConfig;

