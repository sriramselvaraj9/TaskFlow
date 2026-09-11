import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '@/lib/authHelper';
import { setPasswordWithInviteToken } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
      return res.status(400).json({
        message: 'Missing required parameters: email, invitation token, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long.',
      });
    }

    const updatedUser = await setPasswordWithInviteToken(
      email.trim().toLowerCase(),
      token.trim(),
      password,
    );

    return res.status(200).json({
      message: 'Password created successfully. You can now access your workspace.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        designation: updatedUser.designation,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || 'Failed to set account password.',
    });
  }
}
