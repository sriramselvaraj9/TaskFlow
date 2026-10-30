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
      const cleanUrl = rawBackendUrl
        .trim()
        .replace(/\/+$/, '')
        .replace(/\/task_management\/api\/v1$/, '')
        .replace(/\/api$/, '');
      return {
        // Use fallback so Next.js pages/api handlers (e.g. users/[id], auth, etc.)
        // always take precedence and handle session cookies properly.
        fallback: [
          { source: '/task_management/api/v1/:path*', destination: `${cleanUrl}/task_management/api/v1/:path*` },
          { source: '/api/tasks/:path*', destination: `${cleanUrl}/task_management/api/v1/tasks/:path*` },
          { source: '/api/tasks', destination: `${cleanUrl}/task_management/api/v1/tasks` },
          { source: '/api/projects/:path*', destination: `${cleanUrl}/task_management/api/v1/projects/:path*` },
          { source: '/api/projects', destination: `${cleanUrl}/task_management/api/v1/projects` },
          { source: '/api/columns/:path*', destination: `${cleanUrl}/task_management/api/v1/columns/:path*` },
          { source: '/api/columns', destination: `${cleanUrl}/task_management/api/v1/columns` },
          { source: '/api/dashboard/:path*', destination: `${cleanUrl}/task_management/api/v1/dashboard/:path*` },
          { source: '/api/activities/:path*', destination: `${cleanUrl}/task_management/api/v1/activities/:path*` },
          { source: '/api/activities', destination: `${cleanUrl}/task_management/api/v1/activities` },
          { source: '/api/users/:path*', destination: `${cleanUrl}/task_management/api/v1/users/:path*` },
          { source: '/api/users', destination: `${cleanUrl}/task_management/api/v1/users` },
          { source: '/api/health', destination: `${cleanUrl}/task_management/api/v1/health` },
        ],
      };
    }
    return [];
  },
};

module.exports = nextConfig;
