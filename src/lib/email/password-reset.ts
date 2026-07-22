import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function getEmailFrom(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  return from || null;
}

export function buildPasswordResetHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:8px 8px 0 0;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">Reset Your Password</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        We received a request to reset your SignalScope password. Click the button below to choose a new password.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;">
          Reset Password
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        If the button doesn't work, copy and paste this URL into your browser:<br/>
        <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${resetUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<boolean> {
  const emailFrom = getEmailFrom();
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping password reset email");
    return false;
  }
  if (!emailFrom) {
    console.log("[email] EMAIL_FROM not set — skipping password reset email");
    return false;
  }

  const html = buildPasswordResetHtml(resetUrl);

  const { error } = await resend.emails.send({
    from: emailFrom,
    to: email,
    subject: "Reset your SignalScope password",
    html,
  });

  if (error) {
    console.warn("[email] Password reset send failed:", error);
    return false;
  }

  return true;
}
