import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, resolveBaseUrl } from '@/lib/authHelper';
import { requestForgotPassword } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email, frontendUrl } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const baseUrl = resolveBaseUrl(req, frontendUrl);
    const result = await requestForgotPassword(email.trim().toLowerCase(), baseUrl);

    return res.status(200).json(result);
  } catch (error: any) {
    // Maintain security parity even if downstream error occurs
    return res.status(200).json({
      success: true,
      message: 'If an account with this email address exists, a password reset link has been sent to your inbox.',
      emailSent: true,
    });
  }
}
