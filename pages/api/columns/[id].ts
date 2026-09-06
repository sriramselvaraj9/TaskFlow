import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { deleteColumn, getUserById } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const currentUser = (await getUserById(session.user.id)) || {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role || 'MEMBER',
    designation: session.user.role === 'ADMIN' ? 'Lead Administrator' : 'Software Engineer',
    createdAt: new Date().toISOString(),
  };

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid column ID' });
  }

  if (req.method === 'DELETE') {
    try {
      if (currentUser.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Unauthorized: Only Admins can delete columns' });
      }

      // when the coloumn deleted the data is goes to the backlog space and stored in the database
      const result = await deleteColumn(id, currentUser);
      return res.status(200).json({
        message: 'Column deleted successfully',
        movedTasksCount: result.movedTasksCount,
        deletedColumn: result.deletedColumn,
      });
    } catch (error: any) {
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to delete column' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
