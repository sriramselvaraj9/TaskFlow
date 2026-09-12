import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getUserById, getUserByEmail } from '@/lib/db';
import type { User } from '@/types';

export function applyCors(req: NextApiRequest, res: NextApiResponse): boolean {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export async function getAuthenticatedUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<User | null> {
  // Strategy 1: Standard NextAuth getServerSession
  try {
    const session = await getServerSession(req, res, authOptions);
    if (session?.user?.id) {
      const user = await getUserById(session.user.id);
      if (user) return user;
    }
    if (session?.user?.email) {
      const user = await getUserByEmail(session.user.email);
      if (user) return user;
    }
  } catch {
    // NextAuth session lookup might throw on proxied host headers
  }

  // Strategy 2: Direct JWT Token verification (works across Vercel -> Render proxy rewrites)
  try {
    const token = await getToken({
      req,
      secret: (authOptions.secret as string) || 'taskflow-monochrome-super-secret-key-2026',
    });
    if (token) {
      const userId = (token.id || token.sub) as string | undefined;
      if (userId) {
        const user = await getUserById(userId);
        if (user) return user;
      }
      if (token.email) {
        const user = await getUserByEmail(token.email as string);
        if (user) return user;
      }
      // Fallback user object from token claims if database record not loaded yet
      if (userId && token.email) {
        return {
          id: userId,
          name: (token.name as string) || '',
          email: token.email as string,
          role: (token.role as 'ADMIN' | 'MEMBER') || 'MEMBER',
          designation: (token.designation as string) || undefined,
          createdAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // JWT token parsing failed
  }

  return null;
}

/**
 * Resolves the accurate public base URL for links (invitations, password resets),
 * dynamically prioritizing reverse proxies, request headers, client origins,
 * and environment configurations.
 */
export function resolveBaseUrl(req: NextApiRequest, clientUrl?: string): string {
  // 1. Explicit client origin passed from window.location.origin
  if (clientUrl && typeof clientUrl === 'string' && clientUrl.trim()) {
    const trimmed = clientUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // 2. Incoming Origin header
  if (req.headers.origin && typeof req.headers.origin === 'string') {
    return req.headers.origin.replace(/\/+$/, '');
  }

  // 3. Incoming Referer header
  if (req.headers.referer && typeof req.headers.referer === 'string') {
    try {
      const refUrl = new URL(req.headers.referer);
      return `${refUrl.protocol}//${refUrl.host}`;
    } catch {}
  }

  // 4. Host header + forwarded protocol (Handles Render / Vercel / Docker / Cloudflare / Nginx)
  const rawHost = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (host) {
    const rawProto = req.headers['x-forwarded-proto'];
    const protoStr = Array.isArray(rawProto) ? rawProto[0] : rawProto;
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = protoStr || (isLocal ? 'http' : 'https');
    return `${protocol}://${host}`.replace(/\/+$/, '');
  }

  // 5. Configured environment variables (FRONTEND_URL, NEXT_PUBLIC_APP_URL, APP_URL, NEXTAUTH_URL)
  const envUrl = (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL
  )?.trim();

  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}
