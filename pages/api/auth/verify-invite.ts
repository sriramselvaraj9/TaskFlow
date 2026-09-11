import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '@/lib/authHelper';
import { verifyInviteToken } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email, token } = req.query;

    if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: 'Email and invitation token are required.' });
    }

    const verification = await verifyInviteToken(email, token);

    if (!verification.valid || !verification.user) {
      return res.status(400).json({
        valid: false,
        message: verification.message || 'Invalid or expired invitation token.',
      });
    }

    return res.status(200).json({
      valid: true,
      user: {
        id: verification.user.id,
        name: verification.user.name,
        email: verification.user.email,
        role: verification.user.role,
        designation: verification.user.designation,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ valid: false, message: error.message || 'Failed to verify invitation' });
  }
}
