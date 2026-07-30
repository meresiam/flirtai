import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// SMTP genérico via env (funciona com Resend, Mailgun, Gmail app password, etc.).
// Sem SMTP_HOST o envio vira log em stdout — em dev o link de reset sai no
// terminal do `npm run dev` em vez de chegar por email.
export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  const host = process.env.SMTP_HOST;

  if (!host) {
    console.warn(
      `[email] SMTP_HOST não configurado — email NÃO enviado.\n  Para: ${to}\n  Assunto: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`,
    );
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
