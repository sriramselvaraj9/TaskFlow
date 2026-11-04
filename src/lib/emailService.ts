interface SendInviteEmailParams {
  to: string;
  inviteUrl: string;
  userName?: string;
  inviterName?: string;
  role?: string;
  designation?: string;
}

export interface SendEmailResult {
  sent: boolean;
  inviteUrl: string;
  error?: string;
}

interface ParsedSender {
  name: string;
  email: string;
}

function parseSender(rawFrom?: string, fallbackEmail?: string): ParsedSender {
  const candidate = (rawFrom || '').trim();
  let name = 'TaskFlow Admin';
  let email = (fallbackEmail || '').trim() || 'sriramccbp@gmail.com';

  if (candidate) {
    const angleMatch = candidate.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/);
    if (angleMatch) {
      if (angleMatch[1]?.trim()) {
        name = angleMatch[1].trim();
      }
      if (angleMatch[2]?.trim()) {
        email = angleMatch[2].trim().toLowerCase();
      }
    } else if (candidate.includes('@') && !candidate.includes(' ')) {
      email = candidate.trim().toLowerCase();
    } else {
      name = candidate;
    }
  }

  email = email.replace(/[<>"'\s]/g, '').toLowerCase();

  return { name, email };
}

function getBrevoApiConfig() {
  const apiKey =
    process.env.BREVO_API_KEY ||
    (process.env.BREVO_SMTP_KEY?.startsWith('xkeysib-') ? process.env.BREVO_SMTP_KEY : undefined);

  if (!apiKey || (!apiKey.startsWith('xkeysib-') && apiKey.length < 20)) {
    return null;
  }

  const sender = parseSender(
    process.env.BREVO_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM,
    process.env.BREVO_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_USER,
  );

  return {
    apiKey: apiKey.trim(),
    fromEmail: sender.email,
    fromName: sender.name,
  };
}

export const emailService = {
  async sendInviteEmail({
    to,
    inviteUrl,
    userName = 'Team Member',
    inviterName = 'Admin',
    designation,
  }: SendInviteEmailParams): Promise<SendEmailResult> {
    const brevoConfig = getBrevoApiConfig();
    if (!brevoConfig) {
      console.warn('[TaskFlow Email] Brevo API key not configured in environment.');
      return {
        sent: false,
        inviteUrl,
        error: 'Brevo API key not configured in environment.',
      };
    }

    const roleInfo = designation ? ` as ${designation}` : '';
    const subject = "You're invited to join TaskFlow - Set up your account";

    const textContent = `
Hi ${userName},

You have been invited to join the TaskFlow workspace by ${inviterName}${roleInfo}.

Click the link below to set your account password and get started:
${inviteUrl}

This invitation link is valid for 7 days.

- The TaskFlow Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskFlow Workspace Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
    <tr>
      <td style="background-color: #4f46e5; padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">TaskFlow</h1>
        <p style="color: #e0e7ff; font-size: 14px; margin: 6px 0 0; font-weight: 500;">High-Performance Team Workspace</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 36px 32px;">
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 16px;">Welcome to the Team, ${userName}! 👋</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          <strong>${inviterName}</strong> has invited you to join the TaskFlow workspace${roleInfo}.
        </p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
          To complete your account setup and access your assigned projects and tasks, please click the button below to set your account password.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
          <tr>
            <td align="center">
              <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                Accept Invitation & Set Password →
              </a>
            </td>
          </tr>
        </table>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-top: 24px;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 4px; font-weight: 600;">Button not working? Copy and paste this link in your browser:</p>
          <p style="color: #4f46e5; font-size: 12px; word-break: break-all; margin: 0; font-family: monospace;">
            <a href="${inviteUrl}" style="color: #4f46e5; text-decoration: underline;">${inviteUrl}</a>
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; line-height: 1.5;">
          ⏳ This invitation link expires in <strong>7 days</strong>.<br>
          If you were not expecting this invitation, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} TaskFlow Workspace. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoConfig.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: brevoConfig.fromName, email: brevoConfig.fromEmail },
          to: [{ email: to, name: userName || to.split('@')[0] }],
          subject,
          htmlContent,
          textContent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errorMsg =
          errBody.message || `Brevo API returned HTTP ${res.status} (${res.statusText || 'Error'})`;
        console.warn('[TaskFlow Email] Brevo REST API returned error:', res.status, errBody);
        return { sent: false, inviteUrl, error: errorMsg };
      }

      console.info(
        `[TaskFlow Email] Invite email dispatched successfully to ${to} via Brevo REST API.`,
      );
      return { sent: true, inviteUrl };
    } catch (err: any) {
      const errorMsg =
        err?.name === 'AbortError'
          ? 'Brevo API request timed out'
          : err?.message || 'Network error';
      console.warn('[TaskFlow Email] Brevo API request failed:', errorMsg);
      return { sent: false, inviteUrl, error: errorMsg };
    }
  },

  async sendPasswordResetEmail({
    to,
    resetUrl,
    userName = 'Team Member',
  }: {
    to: string;
    resetUrl: string;
    userName?: string;
  }): Promise<SendEmailResult> {
    const brevoConfig = getBrevoApiConfig();
    if (!brevoConfig) {
      return {
        sent: false,
        inviteUrl: resetUrl,
        error: 'Brevo API key not configured in environment.',
      };
    }

    const subject = 'TaskFlow Password Reset Request';
    const textContent = `
Hi ${userName},

A password reset request was received for your TaskFlow account.

Click the link below to establish a new password (valid for 15 minutes):
${resetUrl}

If you did not request a password reset, you can safely ignore this email.

- The TaskFlow Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="color: #4f46e5; margin-top: 0;">TaskFlow Password Reset</h2>
    <p>Hi ${userName},</p>
    <p>We received a request to reset your TaskFlow account password. Click the button below to proceed:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">This link expires in 15 minutes. If you did not make this request, you can safely ignore this email.</p>
  </div>
</body>
</html>
    `.trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoConfig.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: brevoConfig.fromName, email: brevoConfig.fromEmail },
          to: [{ email: to, name: userName || to.split('@')[0] }],
          subject,
          htmlContent,
          textContent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { sent: false, inviteUrl: resetUrl, error: `HTTP ${res.status}` };
      }
      return { sent: true, inviteUrl: resetUrl };
    } catch (err: any) {
      return { sent: false, inviteUrl: resetUrl, error: err?.message || 'Network error' };
    }
  },
};
