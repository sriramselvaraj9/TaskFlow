import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser, resolveBaseUrl } from '@/lib/authHelper';
import { createInviteToken, createUser, emailService, getUserByEmail } from '@/lib/db';
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
        .json({ message: 'Forbidden: Only Admins can provision new team members.' });
    }

    const { name, email, role, designation, frontendUrl } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ message: 'Missing required user fields: name and email are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await getUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this corporate email already exists.' });
    }

    // Role is optional, default to MEMBER in DB
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    const cleanDesignation = designation?.trim() ? designation.trim() : undefined;

    // Create user without requiring password initially
    const newUser = await createUser({
      name: name.trim(),
      email: cleanEmail,
      role: userRole,
      designation: cleanDesignation,
    });

    // Generate 7-day secure invite token
    const inviteToken = await createInviteToken(cleanEmail);

    // Build absolute invitation link pointing to the public frontend UI
    const baseUrl = resolveBaseUrl(req, frontendUrl);
    const inviteUrl = `${baseUrl}/auth/set-password?token=${inviteToken}&email=${encodeURIComponent(cleanEmail)}`;

    // Send invitation email via Brevo REST API / SMTP (safe error handling)
    let emailResult: SendEmailResult = { sent: false, inviteUrl };
    try {
      emailResult = await emailService.sendInviteEmail({
        to: cleanEmail,
        inviteUrl,
        userName: newUser.name,
        inviterName: currentUser.name || 'Lead Administrator',
        designation: newUser.designation,
      });
    } catch (emailErr: any) {
      console.warn('[TaskFlow Email] Non-fatal error sending invite email:', emailErr?.message || emailErr);
      emailResult = {
        sent: false,
        inviteUrl,
        error: emailErr?.message || 'Failed to dispatch email',
      };
    }

    return res.status(201).json({
      message: emailResult.sent
        ? `Invitation email sent to ${cleanEmail}`
        : `Member added. Email could not be sent automatically.`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        designation: newUser.designation,
      },
      inviteUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.error,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to provision user' });
  }
}
