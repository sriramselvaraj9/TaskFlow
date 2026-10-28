import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const backendUrl =
          process.env.BACKEND_URL ||
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          'http://127.0.0.1:8000';
        const cleanUrl = backendUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');

        try {
          const res = await fetch(`${cleanUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email.trim().toLowerCase(),
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.detail || 'Invalid email or password');
          }

          const data = await res.json();
          const cleanEmail = (data.user?.email || credentials.email).trim().toLowerCase();
          const isAdminEmail = cleanEmail === 'sriramccbp@gmail.com' || cleanEmail === 'admin@gmail.com';
          const resolvedRole = isAdminEmail ? 'ADMIN' : (String(data.user?.role || 'MEMBER').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'MEMBER');

          return {
            id: data.user.id,
            name: data.user.name,
            email: cleanEmail,
            role: resolvedRole,
            designation: data.user.designation,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: Math.floor(Date.now() / 1000) + (data.expiresIn || 1800),
          };
        } catch (error: any) {
          throw new Error(error.message || 'Authentication failed');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = (user as any).role;
        token.designation = (user as any).designation;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.expiresAt = (user as any).expiresAt;
      }

      // Ensure admin accounts maintain ADMIN role
      const email = String(token.email || '').toLowerCase().trim();
      const roleStr = String(token.role || '').toUpperCase();
      if (email === 'sriramccbp@gmail.com' || email === 'admin@gmail.com' || roleStr === 'ADMIN') {
        token.role = 'ADMIN';
      } else if (!token.role) {
        token.role = 'MEMBER';
      }

      // Proactively rotate expired or soon-to-expire access tokens
      if (token.expiresAt && token.refreshToken && Date.now() / 1000 > (token.expiresAt as number) - 60) {
        try {
          const backendUrl =
            process.env.BACKEND_URL ||
            process.env.NEXT_PUBLIC_BACKEND_URL ||
            'http://127.0.0.1:8000';
          const cleanUrl = backendUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
          const refreshRes = await fetch(`${cleanUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshed = await refreshRes.json();
            token.accessToken = refreshed.accessToken;
            token.refreshToken = refreshed.refreshToken;
            token.expiresAt = Math.floor(Date.now() / 1000) + (refreshed.expiresIn || 1800);
          } else {
            // Drop expired access token so server-to-server calls dynamically generate valid internal tokens
            delete (token as any).accessToken;
          }
        } catch (err) {
          delete (token as any).accessToken;
          console.warn('[NextAuth] Token refresh error:', err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || session.user.id;
        const email = String(token.email || session.user.email || '').toLowerCase().trim();
        const roleStr = String(token.role || session.user.role || '').toUpperCase();
        if (email === 'sriramccbp@gmail.com' || email === 'admin@gmail.com' || roleStr === 'ADMIN') {
          session.user.role = 'ADMIN';
        } else {
          session.user.role = (roleStr as 'ADMIN' | 'MEMBER') || 'MEMBER';
        }
        (session.user as any).designation = token.designation as string;
      }
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'taskflow-super-secure-production-secret-key-32chars',
};

export default NextAuth(authOptions);
