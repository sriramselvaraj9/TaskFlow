import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { createUser, getUserByEmail, getUserById } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized. Please sign in.' });
    }

    const currentUser = (await getUserById(session.user.id)) || {
      id: session.user.id,
      name: session.user.name || '',
      email: session.user.email || '',
      role: session.user.role || 'MEMBER',
      designation: session.user.role === 'ADMIN' ? 'Lead Administrator' : 'Software Engineer',
      createdAt: new Date().toISOString(),
    };
    if (currentUser?.role !== 'ADMIN') {
      return res
        .status(403)
        .json({ message: 'Forbidden: Only Admins can provision new team members.' });
    }

    const { name, email, password, role, designation } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Missing required user fields: name, email, password.' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this corporate email already exists.' });
    }

    const newUser = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordAttempt: password,
      role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      designation: designation?.trim(),
    });

    return res.status(201).json({
      message: 'User provisioned successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        designation: newUser.designation,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to provision user' });
  }
}
