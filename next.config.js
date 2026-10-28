/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL;

    if (rawBackendUrl) {
      const cleanUrl = rawBackendUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
      return {
        // Use fallback so Next.js pages/api handlers (e.g. users/[id], auth, etc.)
        // always take precedence and handle session cookies properly.
        fallback: [
          { source: '/api/tasks/:path*', destination: `${cleanUrl}/api/tasks/:path*` },
          { source: '/api/tasks', destination: `${cleanUrl}/api/tasks` },
          { source: '/api/projects/:path*', destination: `${cleanUrl}/api/projects/:path*` },
          { source: '/api/projects', destination: `${cleanUrl}/api/projects` },
          { source: '/api/columns/:path*', destination: `${cleanUrl}/api/columns/:path*` },
          { source: '/api/columns', destination: `${cleanUrl}/api/columns` },
          { source: '/api/dashboard/:path*', destination: `${cleanUrl}/api/dashboard/:path*` },
          { source: '/api/activities/:path*', destination: `${cleanUrl}/api/activities/:path*` },
          { source: '/api/activities', destination: `${cleanUrl}/api/activities` },
          { source: '/api/users/:path*', destination: `${cleanUrl}/api/users/:path*` },
          { source: '/api/users', destination: `${cleanUrl}/api/users` },
          { source: '/api/health', destination: `${cleanUrl}/api/health` },
        ],
      };
    }
    return [];
  },
};

module.exports = nextConfig;
