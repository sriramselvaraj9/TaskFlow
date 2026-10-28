import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser, isAdmin, resolveBaseUrl } from '@/lib/authHelper';
import { getUserByEmail, provisionUser } from '@/lib/db';
import { emailService } from '@/lib/emailService';

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

    if (!isAdmin(currentUser)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: Only Admins can provision new team members.' });
    }

    currentUser.role = 'ADMIN';

    const { name, email, role, designation, frontendUrl } = req.body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return res
        .status(400)
        .json({ message: 'Corporate email is mandatory.' });
    }

    const cleanName =
      typeof name === 'string' && name.trim().length >= 2
        ? name.trim()
        : cleanEmail.split('@')[0] || 'Team Member';

    const existingUser = await getUserByEmail(cleanEmail, currentUser);
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this corporate email already exists.' });
    }

    const userRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    const cleanDesignation = designation?.trim() ? designation.trim() : undefined;
    const baseUrl = resolveBaseUrl(req, frontendUrl);

    // Call backend to create user, persist invite token in DB, and dispatch email via backend email service
    const result = await provisionUser(
      {
        name: cleanName,
        email: cleanEmail,
        role: userRole,
        designation: cleanDesignation,
        frontendUrl: baseUrl,
      },
      currentUser
    );

    // If backend direct dispatch did not succeed, attempt frontend Next.js fallback dispatch
    if (!result.emailSent && result.inviteUrl) {
      try {
        const dispatch = await emailService.sendInviteEmail({
          to: cleanEmail,
          userName: cleanName,
          inviteUrl: result.inviteUrl,
          inviterName: currentUser.name || 'Workspace Administrator',
          designation: cleanDesignation,
        });
        if (dispatch.sent) {
          result.emailSent = true;
          delete result.emailError;
        }
      } catch (err: any) {
        console.warn('[TaskFlow Frontend] Fallback invite email dispatch:', err?.message);
      }
    }

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to provision user' });
  }
}
