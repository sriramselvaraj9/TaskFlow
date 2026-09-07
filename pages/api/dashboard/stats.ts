import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser } from '@/lib/authHelper';
import { getDashboardStats } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  const currentUser = await getAuthenticatedUser(req, res);

  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { projectId } = req.query;
      const stats = await getDashboardStats(typeof projectId === 'string' ? projectId : undefined);
      return res.status(200).json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || 'Failed to fetch dashboard stats' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
