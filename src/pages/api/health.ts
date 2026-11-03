import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '@/lib/authHelper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  return res.status(200).json({
    service: 'TaskFlow',
    message: 'APIs are running successfully',
    timestamp: new Date().toISOString(),
  });
}
