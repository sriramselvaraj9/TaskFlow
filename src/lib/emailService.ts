import nodemailer from 'nodemailer';

export interface SendOtpEmailParams {
  to: string;
  otpCode: string;
  userName?: string;
}

export interface SendInviteEmailParams {
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
  formatted: string;
}

/**
 * Robustly parses name and clean email from various sender environment formats:
 * - "TaskFlow Admin" <sriramccbp@gmail.com>
 * - TaskFlow Admin <sriramccbp@gmail.com>
 * - sriramccbp@gmail.com
 */
function parseSender(
  rawFrom?: string,
  fallbackEmail?: string,
  defaultName = 'TaskFlow Admin',
  defaultEmail = 'noreply@taskflow.dev',
): ParsedSender {
  const candidate = (rawFrom || '').trim();
  let name = defaultName;
  let email = (fallbackEmail || '').trim() || defaultEmail;

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

  // Sanitize email: remove any brackets, quotes, or spaces
  email = email.replace(/[<>"'\s]/g, '').toLowerCase();

  return {
    name,
    email,
    formatted: `"${name}" <${email}>`,
  };
}

interface BrevoApiConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

function getBrevoApiConfig(): BrevoApiConfig | null {
  const apiKey =
    process.env.BREVO_API_KEY ||
    (process.env.BREVO_SMTP_KEY?.startsWith('xkeysib-') ? process.env.BREVO_SMTP_KEY : undefined);

  if (!apiKey || (!apiKey.startsWith('xkeysib-') && apiKey.length < 20)) {
    return null;
  }

  const sender = parseSender(
    process.env.BREVO_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM,
    process.env.BREVO_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_USER,
    'TaskFlow Admin',
    'sriramccbp@gmail.com',
  );

  return {
    apiKey: apiKey.trim(),
    fromEmail: sender.email,
    fromName: sender.name,
  };
}

async function sendViaBrevoApi({
  apiKey,
  fromEmail,
  fromName,
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
}: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ sent: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail, name: toName || toEmail.split('@')[0] }],
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
        errBody.message ||
        `Brevo API returned HTTP ${res.status} (${res.statusText || 'Error'})`;
      console.warn('[TaskFlow Email] Brevo REST API returned error:', res.status, errBody);
      return { sent: false, error: errorMsg };
    }

    return { sent: true };
  } catch (err: any) {
    const errorMsg = err?.name === 'AbortError' ? 'Brevo API request timed out' : err?.message || 'Network error';
    console.warn('[TaskFlow Email] Brevo API request failed:', errorMsg);
    return { sent: false, error: errorMsg };
  }
}

interface TransporterConfig {
  transporter: nodemailer.Transporter;
  from: string;
}

function getEmailTransporter(): TransporterConfig | null {
  const defaultSender = parseSender(
    process.env.BREVO_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM,
    process.env.BREVO_USER || process.env.SMTP_USER || process.env.GMAIL_USER,
    'TaskFlow Workspace',
    'noreply@taskflow.dev',
  );

  // 1. Check Brevo SMTP configuration
  const brevoKey = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
  const brevoUser = process.env.BREVO_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_USER;

  if (brevoKey && brevoUser) {
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT) || 587,
      secure: process.env.BREVO_SMTP_SECURE === 'true' || Number(process.env.BREVO_SMTP_PORT) === 465,
      auth: {
        user: brevoUser.trim(),
        pass: brevoKey.trim(),
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });
    return { transporter, from: defaultSender.formatted };
  }

  // 2. Check Custom SMTP configuration
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: isSecure,
      auth: {
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });
    return { transporter, from: defaultSender.formatted };
  }

  // 3. Check Gmail SMTP configuration
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;
  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.trim(),
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    return { transporter, from: `"TaskFlow Security" <${gmailUser.trim()}>` };
  }

  return null;
}

export const emailService = {
  /**
   * Sends the workspace invitation email to newly provisioned members.
   * Prioritizes Brevo REST API v3 (HTTPS 443) which works unconditionally on all cloud platforms,
   * then falls back to SMTP transporter, and cleanly logs actionable details if credentials are not set.
   */
  async sendInviteEmail({
    to,
    inviteUrl,
    userName = 'Team Member',
    inviterName = 'TaskFlow Administrator',
    designation,
  }: SendInviteEmailParams): Promise<SendEmailResult> {
    const roleInfo = designation ? ` as <strong>${designation}</strong>` : '';
    const subject = `You've been invited to join TaskFlow Workspace`;
    const textContent = `Hello ${userName},\n\n${inviterName} has invited you to join the TaskFlow workspace${designation ? ` as ${designation}` : ''}.\n\nClick the link below to set your password and access your workspace:\n${inviteUrl}\n\nThis invitation link is valid for 7 days.\n\nBest regards,\nTaskFlow Team`;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>TaskFlow Workspace Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 32px 16px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
            <!-- Header with Gradient Accent -->
            <tr>
              <td style="background-color: #0f1422; padding: 28px 32px; border-bottom: 2px solid #4f46e5;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <div style="display: inline-block; vertical-align: middle; background-color: #4f46e5; border-radius: 10px; width: 36px; height: 36px; text-align: center; line-height: 36px; color: #ffffff; font-weight: bold; font-size: 18px;">✓</div>
                      <span style="display: inline-block; vertical-align: middle; margin-left: 10px; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">TaskFlow</span>
                    </td>
                    <td align="right">
                      <span style="display: inline-block; background-color: rgba(79, 70, 229, 0.15); border: 1px solid rgba(79, 70, 229, 0.3); color: #818cf8; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">Workspace Invite</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 32px;">
                <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 14px; line-height: 1.3;">
                  Welcome to the Team, ${userName}! 👋
                </h1>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                  <strong>${inviterName}</strong> has invited you to join the TaskFlow workspace${roleInfo}.
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                  To complete your account setup and access your assigned projects and tasks, please click the button below to set your account password.
                </p>

                <!-- CTA Button -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                  <tr>
                    <td align="center">
                      <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); text-align: center;">
                        Accept Invitation & Set Password →
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback URL -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 24px;">
                  <p style="color: #64748b; font-size: 11px; margin: 0 0 6px; font-weight: 600;">Button not working? Copy and paste this link in your browser:</p>
                  <p style="color: #4f46e5; font-size: 11px; word-break: break-all; margin: 0; font-family: monospace;">
                    <a href="${inviteUrl}" style="color: #4f46e5; text-decoration: underline;">${inviteUrl}</a>
                  </p>
                </div>

                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
                    ⏳ This invitation link expires in <strong>7 days</strong>.<br>
                    If you were not expecting this invitation, please disregard this email.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                  © ${new Date().getFullYear()} TaskFlow Enterprise Portal. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

    // 1. First priority: Direct Brevo REST API v3 (over HTTPS port 443, never blocked by cloud firewalls)
    const brevoApi = getBrevoApiConfig();
    if (brevoApi) {
      const result = await sendViaBrevoApi({
        apiKey: brevoApi.apiKey,
        fromEmail: brevoApi.fromEmail,
        fromName: brevoApi.fromName,
        toEmail: to,
        toName: userName,
        subject,
        htmlContent,
        textContent,
      });
      if (result.sent) {
        return { sent: true, inviteUrl };
      }
    }

    // 2. Second priority: SMTP transporter (Nodemailer)
    const emailConfig = getEmailTransporter();

    if (!emailConfig) {
      console.warn(
        `\n=======================================================\n` +
          `[TaskFlow Email] Brevo or SMTP credentials not configured in environment.\n` +
          `Recipient: ${to} (${userName})\n` +
          `Invited by: ${inviterName}\n` +
          `Set Password Link:\n${inviteUrl}\n` +
          `=======================================================\n`,
      );
      return {
        sent: false,
        inviteUrl,
        error: 'Email credentials not configured in server environment variables.',
      };
    }

    const { transporter, from } = emailConfig;

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });

      return { sent: true, inviteUrl };
    } catch (sendErr: any) {
      const errorMsg = sendErr?.message || 'SMTP connection failed';
      console.warn(
        `\n[TaskFlow Email] SMTP sending error (falling back to generated link):\n` +
          `${errorMsg}\n` +
          `Set Password Link:\n${inviteUrl}\n`,
      );
      return { sent: false, inviteUrl, error: errorMsg };
    }
  },

  /**
   * Sends the OTP verification code email for password resets.
   */
  async sendOtpEmail({ to, otpCode, userName = 'Team Member' }: SendOtpEmailParams): Promise<{ sent: boolean; error?: string }> {
    const subject = `Your Taskflow Verification Code: ${otpCode}`;
    const textContent = `Hello ${userName},\n\nYour Taskflow password reset OTP code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <div style="background-color: #4f46e5; border-radius: 6px; width: 24px; height: 24px; display: inline-block; text-align: center; line-height: 24px; color: #ffffff; font-weight: bold; font-size: 14px;">✓</div>
            <h2 style="color: #0f1422; margin: 0; display: inline-block; font-size: 18px; font-weight: bold;">Taskflow Security</h2>
          </div>
          <p style="color: #334155; font-size: 14px; margin: 0 0 12px;">Hello <strong>${userName}</strong>,</p>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">Use the following 6-digit verification code to reset your account password:</p>
          <div style="text-align: center; margin: 20px 0; padding: 16px; background-color: #f1f5f9; border-radius: 8px;">
            <span style="font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #4f46e5;">${otpCode}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; margin: 16px 0 0;">This code is valid for <strong>10 minutes</strong>. If you did not make this request, please disregard this email.</p>
        </div>
      `;

    // 1. Try Brevo REST API v3 first
    const brevoApi = getBrevoApiConfig();
    if (brevoApi) {
      const result = await sendViaBrevoApi({
        apiKey: brevoApi.apiKey,
        fromEmail: brevoApi.fromEmail,
        fromName: brevoApi.fromName,
        toEmail: to,
        toName: userName,
        subject,
        htmlContent,
        textContent,
      });
      if (result.sent) {
        return { sent: true };
      }
    }

    // 2. Fallback to SMTP
    const emailConfig = getEmailTransporter();
    if (!emailConfig) {
      console.warn(
        `\n=======================================================\n` +
          `[TaskFlow Email] SMTP credentials not configured in environment.\n` +
          `Recipient: ${to}\n` +
          `Verification Code: ${otpCode}\n` +
          `=======================================================\n`,
      );
      return { sent: false, error: 'Email credentials not configured in server environment.' };
    }

    const { transporter, from } = emailConfig;

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      return { sent: true };
    } catch (err: any) {
      return { sent: false, error: err?.message || 'Failed to send OTP email' };
    }
  },
};
