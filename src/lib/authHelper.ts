import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import type { User } from '@/types';

export interface AuthenticatedUser extends User {
  accessToken?: string;
}

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

export const ADMIN_EMAILS = new Set([
  'sriramccbp@gmail.com',
  'admin@gmail.com',
]);

export function isAdmin(user?: Partial<User> | { email?: string; role?: string; id?: string } | null): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (role === 'ADMIN') return true;
  const email = (user.email || '').trim().toLowerCase();
  if (ADMIN_EMAILS.has(email)) return true;
  if (user.id === 'user-admin-1' || user.id === 'user-admin-2') return true;
  return false;
}

export async function getAuthenticatedUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser | null> {
  const secret = (authOptions.secret as string) || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'taskflow-super-secure-production-secret-key-32chars';

  // Strategy 0: Direct Authorization Header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    if (rawToken) {
      try {
        const parts = rawToken.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          const userId = (payload.sub || payload.id) as string | undefined;
          const userEmail = (payload.email || '') as string;
          const userRole = (payload.role || 'MEMBER') as string;
          const userName = (payload.name || '') as string;
          const designation = payload.designation as string | undefined;

          if (userId || userEmail) {
            const isUserAdmin = isAdmin({ id: userId, email: userEmail, role: userRole });
            return {
              id: userId || (isUserAdmin ? 'user-admin-1' : 'user-member-1'),
              name: userName || (isUserAdmin ? 'Admin User' : 'Team Member'),
              email: userEmail || (isUserAdmin ? 'sriramccbp@gmail.com' : 'member@gmail.com'),
              role: isUserAdmin ? 'ADMIN' : (userRole.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'MEMBER'),
              designation,
              accessToken: rawToken,
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Bearer token parsing error, continue to NextAuth session
      }
    }
  }

  // Strategy 1: Standard NextAuth getServerSession
  let sessionUser: AuthenticatedUser | null = null;
  try {
    const session = await getServerSession(req, res, authOptions);
    if (session?.user) {
      const isUserAdmin = isAdmin(session.user);
      sessionUser = {
        id: session.user.id || (isUserAdmin ? 'user-admin-1' : ''),
        name: session.user.name || '',
        email: session.user.email || '',
        role: isUserAdmin ? 'ADMIN' : (String(session.user.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'MEMBER'),
        designation: (session.user as any).designation,
        accessToken: (session as any).accessToken,
        createdAt: new Date().toISOString(),
      };
      if (sessionUser.id || sessionUser.email) {
        return sessionUser;
      }
    }
  } catch {
    // Session retrieval might throw on header variations
  }

  // Strategy 2: Direct JWT Token verification from session cookie
  try {
    const token = await getToken({
      req,
      secret,
    });
    if (token) {
      const userId = (token.id || token.sub) as string | undefined;
      const email = token.email as string | undefined;
      if (userId || email) {
        const isUserAdmin = isAdmin({ id: userId, email, role: token.role as any });
        return {
          id: userId || (isUserAdmin ? 'user-admin-1' : ''),
          name: (token.name as string) || (sessionUser?.name ?? ''),
          email: email || sessionUser?.email || '',
          role: isUserAdmin ? 'ADMIN' : (String(token.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'MEMBER'),
          designation: (token.designation as string) || sessionUser?.designation,
          accessToken: (token.accessToken as string) || sessionUser?.accessToken,
          createdAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // JWT token parsing failed
  }

  if (sessionUser) {
    if (isAdmin(sessionUser)) {
      sessionUser.role = 'ADMIN';
    }
    return sessionUser;
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
