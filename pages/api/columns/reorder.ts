import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { columnService } from '@/server/services/column.service';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized: You must be signed in' });
  }

  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Only Admins can reorder columns' });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const { columnIds } = req.body;
      if (!Array.isArray(columnIds)) {
        return res.status(400).json({ error: 'columnIds must be an array of column IDs' });
      }

      const updatedColumns = await columnService.reorderColumns(columnIds, session.user as any);
      return res.status(200).json(updatedColumns);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to reorder columns' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
