import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getActivities } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const activities = await getActivities(limit);
    return res.status(200).json(activities);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
