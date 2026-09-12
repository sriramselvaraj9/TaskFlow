import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser, resolveBaseUrl } from '@/lib/authHelper';
import { createInviteToken, emailService, getUserByEmail, getUserById } from '@/lib/db';
import type { SendEmailResult } from '@/server/services/email.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const currentUser = await getAuthenticatedUser(req, res);

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized. Please sign in.' });
    }

    if (currentUser.role !== 'ADMIN') {
      return res
        .status(403)
        .json({ message: 'Forbidden: Only Administrators can send member invitations.' });
    }

    const { userId, email, frontendUrl } = req.body;

    let targetUser = null;
    if (userId) {
      targetUser = await getUserById(userId);
    } else if (email) {
      targetUser = await getUserByEmail(email.trim().toLowerCase());
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    // Generate a fresh 7-day secure invite token
    const inviteToken = await createInviteToken(targetUser.email);

    // Build absolute invitation link pointing to the public frontend UI
    const baseUrl = resolveBaseUrl(req, frontendUrl);
    const inviteUrl = `${baseUrl}/auth/set-password?token=${inviteToken}&email=${encodeURIComponent(targetUser.email)}`;

    // Dispatch invitation email
    let emailResult: SendEmailResult = { sent: false, inviteUrl };
    try {
      emailResult = await emailService.sendInviteEmail({
        to: targetUser.email,
        inviteUrl,
        userName: targetUser.name,
        inviterName: currentUser.name || 'Lead Administrator',
        designation: targetUser.designation,
      });
    } catch (err: any) {
      emailResult = {
        sent: false,
        inviteUrl,
        error: err?.message || 'Failed to dispatch email',
      };
    }

    return res.status(200).json({
      success: true,
      message: emailResult.sent
        ? `Invitation email sent successfully to ${targetUser.email}`
        : `Invitation link generated. Email could not be sent automatically.`,
      inviteUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.error,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        designation: targetUser.designation,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to generate invitation link' });
  }
}
