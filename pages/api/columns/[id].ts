import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser } from '@/lib/authHelper';
import { deleteColumn } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  const currentUser = await getAuthenticatedUser(req, res);

  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

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
