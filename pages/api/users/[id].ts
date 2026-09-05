import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { deleteUser, getUserById } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const currentUser = await getUserById(session.user.id);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid session user' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  const targetUser = await getUserById(id);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (req.method === 'GET') {
    const { id: uId, name, email, role, designation, createdAt } = targetUser;
    return res.status(200).json({ id: uId, name, email, role, designation, createdAt });
  }

  if (req.method === 'DELETE') {
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only administrators can delete team members' });
    }

    if (currentUser.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    try {
      const success = await deleteUser(id, currentUser);
      if (!success) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error: any) {
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to delete member' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
