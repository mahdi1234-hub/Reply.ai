import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  const mailOptions = {
    from: `"Reply.ai" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Your Reply.ai verification code",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #10b981; font-size: 24px; margin: 0;">Reply.ai</h1>
          <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">Your AI Assistant</p>
        </div>
        <div style="background: #f9fafb; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Your verification code is:</p>
          <div style="background: white; border: 2px solid #10b981; border-radius: 8px; padding: 16px; display: inline-block;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">This code expires in 5 minutes.</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
