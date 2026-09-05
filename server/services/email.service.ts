import nodemailer from 'nodemailer';

export interface SendOtpEmailParams {
  to: string;
  otpCode: string;
  userName?: string;
}

export const emailService = {
  async sendOtpEmail({ to, otpCode, userName = 'Team Member' }: SendOtpEmailParams): Promise<void> {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASS;

    // If Gmail credentials are not configured, log to server console in dev mode
    if (!user || !pass) {
      console.warn(
        `\n=======================================================\n` +
          `[TaskFlow Email] GMAIL_USER or GMAIL_APP_PASS not configured in .env.local.\n` +
          `Recipient: ${to}\n` +
          `Verification Code: ${otpCode}\n` +
          `=======================================================\n`,
      );
      return;
    }

    // Gmail SMTP transporter with credentials
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from: `"TaskFlow Security" <${user}>`,
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
