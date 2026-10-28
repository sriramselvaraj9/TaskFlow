import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '@/lib/authHelper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const hasBrevoKey = Boolean(
      process.env.BREVO_API_KEY ||
      (process.env.BREVO_SMTP_KEY?.startsWith('xkeysib-') ? process.env.BREVO_SMTP_KEY : undefined)
    );
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    const hasGmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASS);

    let activeEmailProvider = 'Not Configured (Fallback logging enabled)';
    if (hasBrevoKey) {
      activeEmailProvider = 'Brevo REST API v3 (HTTPS Port 443)';
    } else if (hasSmtp) {
      activeEmailProvider = 'Custom SMTP';
    } else if (hasGmail) {
      activeEmailProvider = 'Gmail SMTP';
    }

    const healthData = {
      appName: 'TaskFlow',
      apiHealth: 'operational',
      status: 'healthy',
      version: '0.1.1',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        nextAuthUrlConfigured: Boolean(process.env.NEXTAUTH_URL),
        nextAuthSecretConfigured: Boolean(process.env.NEXTAUTH_SECRET),
        emailServiceReady: hasBrevoKey || hasSmtp || hasGmail,
        emailProvider: activeEmailProvider,
        senderVerifiedEmailConfigured: Boolean(
          process.env.BREVO_USER ||
          process.env.BREVO_FROM ||
          process.env.SMTP_FROM ||
          process.env.GMAIL_USER
        ),
      },
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
