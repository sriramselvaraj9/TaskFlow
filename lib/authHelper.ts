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
