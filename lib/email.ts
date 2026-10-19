import nodemailer from "nodemailer";

/**
 * Creates a nodemailer transporter using the Supabase custom SMTP credentials
 * configured in .env.local (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
 */
export function createMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE !== "false"; // default true
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env.local"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      // Allow self-signed certs (common for some SMTP providers)
      rejectUnauthorized: false,
    },
  });
}

/**
 * Sends an HTML email using the configured SMTP transporter.
 * Returns { success: true } on success, { success: false, error: string } on failure.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const from = process.env.EMAIL_FROM || "Jbenz Bistro <noreply@jbenzbistro.com>";
    const transporter = createMailTransporter();
    await transporter.sendMail({ from, to, subject, html });
    console.log(`[Email] Sent to ${to}: "${subject}"`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Failed to send:", err.message);
    return { success: false, error: err.message };
  }
}
