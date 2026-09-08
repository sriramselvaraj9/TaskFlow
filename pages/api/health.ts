import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '@/lib/authHelper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const healthData = {
      appName: 'TaskFlow',
      apiHealth: 'operational',
      status: 'healthy',
      version: '0.1.1',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };

    return res.status(200).json(healthData);
  } catch (error: any) {
    return res.status(503).json({
      appName: 'TaskFlow',
      apiHealth: 'degraded',
      status: 'unhealthy',
      version: '0.1.1',
      error: error.message || 'Service Unavailable',
      timestamp: new Date().toISOString(),
    });
  }
}
