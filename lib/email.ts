import nodemailer from "nodemailer";

/**
 * Creates a nodemailer transporter optimized for Vercel Serverless and local environments.
 * Uses service: 'gmail' for Gmail accounts for reliable connection handling on AWS Lambda/Vercel.
 */
export function createMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE !== "false";
  const user = (process.env.SMTP_USER || "bernardrubia@gmail.com").trim();
  const rawPass = process.env.SMTP_PASS || "xwxygzxubkypvrya";
  // Remove any spaces that might be present in 16-character Google App Passwords
  const pass = rawPass.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_USER and SMTP_PASS in Vercel Environment Variables."
    );
  }

  const isGmail = host === "smtp.gmail.com" || user.endsWith("@gmail.com");

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      // Timeouts crucial for serverless environments to prevent dropped sockets
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
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
    const user = (process.env.SMTP_USER || "bernardrubia@gmail.com").trim();
    const from = process.env.EMAIL_FROM || `Jbenz Bistro <${user}>`;
    const transporter = createMailTransporter();

    const info = await transporter.sendMail({ from, to, subject, html });
    console.log(`[Email] Successfully dispatched to ${to} (Message ID: ${info.messageId})`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Failed to send email via SMTP:", err?.message || err);
    return { success: false, error: err?.message || "Failed to send email" };
  }
}

/**
 * Resolves the public site domain for email links (receipts, profile, bookings).
 * Uses https://www.jbenzbistro.shop as the primary production domain.
 */
export function getPublicSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }
  return "https://www.jbenzbistro.shop";
}



