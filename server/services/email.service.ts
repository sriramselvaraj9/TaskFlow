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

interface TransporterConfig {
  transporter: nodemailer.Transporter;
  from: string;
}

function getEmailTransporter(): TransporterConfig | null {
  // 1. Check Brevo SMTP configuration
  const brevoKey = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
  const brevoUser = process.env.BREVO_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const fromAddress =
    process.env.BREVO_FROM ||
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    `"TaskFlow Workspace" <${brevoUser || process.env.GMAIL_USER || 'noreply@taskflow.dev'}>`;

  if (brevoKey && brevoUser) {
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT) || 587,
      secure: false, // true for 465, false for 587
      auth: {
        user: brevoUser,
        pass: brevoKey,
      },
    });
    return { transporter, from: fromAddress };
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
        user: smtpUser,
        pass: smtpPass,
      },
    });
    return { transporter, from: fromAddress };
  }

  // 3. Check Gmail SMTP configuration
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;
  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
    return { transporter, from: `"TaskFlow Security" <${gmailUser}>` };
  }

  return null;
}

interface BrevoApiConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

function getBrevoApiConfig(): BrevoApiConfig | null {
  const apiKey = process.env.BREVO_API_KEY || (process.env.BREVO_SMTP_KEY?.startsWith('xkeysib-') ? process.env.BREVO_SMTP_KEY : undefined);
  if (!apiKey || !apiKey.startsWith('xkeysib-')) {
    return null;
  }

  const fromEmail = process.env.BREVO_USER || 'sriramccbp@gmail.com';
  const fromName = 'TaskFlow Admin';

  return { apiKey, fromEmail, fromName };
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
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn('[TaskFlow Email] Brevo API returned error:', res.status, errBody);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[TaskFlow Email] Brevo API request failed:', err?.message || err);
    return false;
  }
}

export const emailService = {
  async sendInviteEmail({
    to,
    inviteUrl,
    userName = 'Team Member',
    inviterName = 'TaskFlow Administrator',
    designation,
  }: SendInviteEmailParams): Promise<{ sent: boolean; inviteUrl: string }> {
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

    // 1. First priority: Direct Brevo REST API v3 (if xkeysib- is provided)
    const brevoApi = getBrevoApiConfig();
    if (brevoApi) {
      const success = await sendViaBrevoApi({
        apiKey: brevoApi.apiKey,
        fromEmail: brevoApi.fromEmail,
        fromName: brevoApi.fromName,
        toEmail: to,
        toName: userName,
        subject,
        htmlContent,
        textContent,
      });
      if (success) {
        return { sent: true, inviteUrl };
      }
    }

    // 2. Second priority: SMTP transporter
    const emailConfig = getEmailTransporter();

    // If email credentials are not configured, log clearly in console
    if (!emailConfig) {
      console.warn(
        `\n=======================================================\n` +
          `[TaskFlow Email] Brevo/SMTP credentials not configured in .env.local.\n` +
          `Recipient: ${to} (${userName})\n` +
          `Invited by: ${inviterName}\n` +
          `Set Password Link:\n${inviteUrl}\n` +
          `=======================================================\n`,
      );
      return { sent: false, inviteUrl };
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
      console.warn(
        `\n[TaskFlow Email] SMTP sending error (falling back to generated link):\n` +
          `${sendErr?.message || sendErr}\n` +
          `Set Password Link:\n${inviteUrl}\n`,
      );
      return { sent: false, inviteUrl };
    }
  },

  async sendOtpEmail({ to, otpCode, userName = 'Team Member' }: SendOtpEmailParams): Promise<void> {
    const emailConfig = getEmailTransporter();

    if (!emailConfig) {
      console.warn(
        `\n=======================================================\n` +
          `[TaskFlow Email] SMTP credentials not configured in .env.local.\n` +
          `Recipient: ${to}\n` +
          `Verification Code: ${otpCode}\n` +
          `=======================================================\n`,
      );
      return;
    }

    const { transporter, from } = emailConfig;

    await transporter.sendMail({
      from,
      to,
      subject: `Your Taskflow Verification Code: ${otpCode}`,
      text: `Hello ${userName},\n\nYour Taskflow password reset OTP code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `
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
      `,
    });
  },
};

