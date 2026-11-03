import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '@/lib/authHelper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const rawBackendUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:8000';
  const cleanUrl = rawBackendUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/task_management\/api\/v1$/, '')
    .replace(/\/api$/, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const authHeader = req.headers.authorization;
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  try {
    const backendRes = await fetch(`${cleanUrl}/task_management/api/v1/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body || {}),
    });

    const data = await backendRes.json().catch(() => ({ message: 'Logged out successfully' }));
    return res.status(backendRes.status).json(data);
  } catch (error: any) {
    // Graceful fallback: return success even if backend is offline so client logout completes
    return res.status(200).json({ message: 'Logged out successfully' });
  }
}

