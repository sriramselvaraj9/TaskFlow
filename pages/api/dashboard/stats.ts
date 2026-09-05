import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getDashboardStats } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
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
