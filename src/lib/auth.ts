import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Redefinir senha — Flirt.ai",
        text: [
          `Olá, ${user.name || "tudo bem"}?`,
          "",
          "Recebemos um pedido pra redefinir a senha da sua conta no Flirt.ai.",
          "Abra o link abaixo pra criar uma senha nova (válido por 1 hora):",
          "",
          url,
          "",
          "Se não foi você, pode ignorar este email — sua senha continua a mesma.",
        ].join("\n"),
        html: `
          <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
            <h2 style="margin: 0 0 16px;">Redefinir senha</h2>
            <p>Olá, ${user.name || "tudo bem"}?</p>
            <p>Recebemos um pedido pra redefinir a senha da sua conta no Flirt.ai. O link é válido por 1 hora.</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background: #ff355d; color: #ffffff; padding: 12px 24px; border-radius: 999px; text-decoration: none; display: inline-block;">Criar senha nova</a>
            </p>
            <p style="font-size: 13px; color: #666;">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${url}">${url}</a></p>
            <p style="font-size: 13px; color: #666;">Se não foi você, pode ignorar este email — sua senha continua a mesma.</p>
          </div>
        `,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : undefined,
});

export type Session = typeof auth.$Infer.Session;
