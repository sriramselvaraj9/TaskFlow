import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser } from '@/lib/authHelper';
import { getActivities } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  const currentUser = await getAuthenticatedUser(req, res);

  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const activities = await getActivities(limit);
    return res.status(200).json(activities);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
