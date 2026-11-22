import nodemailer from "nodemailer";
export function emailConfigured(env = process.env) {
  return !!(
    env.SMTP_HOST &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.MAIL_FROM &&
    env.AUTH_CODE_SECRET?.length >= 32
  );
}
export async function sendVerificationEmail({ to, code, purpose }) {
  if (!emailConfigured())
    throw Object.assign(
      new Error("Email verification is currently unavailable."),
      { status: 503 },
    );
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Object.assign(
      new Error("Email verification is currently unavailable."),
      { status: 503 },
    );
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  });
  const reset = purpose === "reset",
    title = reset ? "Reset your password" : "Verify your email";
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: code + " — " + title + " | School Management",
      text:
        title +
        "\n\nYour verification code is " +
        code +
        ".\n\nThis code expires in 10 minutes and can be used once. Never share it with anyone. If you did not request this, ignore this email.",
      html:
        '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#172848"><h2>' +
        title +
        "</h2><p>Use this code to " +
        (reset ? "choose a new password" : "verify your email address") +
        '.</p><p style="font-size:34px;letter-spacing:9px;font-weight:bold;color:#4359ed">' +
        code +
        '</p><p>This code expires in <b>10 minutes</b> and can be used once.</p><p style="color:#73849a;font-size:13px">Never share this code. If you did not request it, ignore this message.</p><hr><small>School Management · Marketectify</small></div>',
    });
  } catch (error) {
    console.error(
      "Verification email delivery failed (" +
        (error.code || error.name) +
        ").",
    );
    throw Object.assign(
      new Error("We could not send your code. Please try again later."),
      { status: 503 },
    );
  } finally {
    transport.close();
  }
}
