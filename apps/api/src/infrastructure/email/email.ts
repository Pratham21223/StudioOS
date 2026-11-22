import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors.js";
import type { EmailPayload } from "../../modules/notifications/notification.service.js";

export type EmailAdapter = {
  send(message: EmailPayload): Promise<void>;
};

const consoleAdapter: EmailAdapter = {
  async send(message) {
    // Never log the body: invitation and reset links are credentials.
    logger.info(
      { to: message.to, subject: message.subject, provider: "console" },
      "email.console_delivery",
    );
  },
};

const resendAdapter: EmailAdapter = {
  async send(message) {
    if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
      throw new AppError(
        503,
        "EMAIL_NOT_CONFIGURED",
        "Resend email delivery requires EMAIL_API_KEY and EMAIL_FROM.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Resend delivery failed (${response.status}): ${detail}`);
    }
  },
};

export function emailAdapter(): EmailAdapter {
  return env.EMAIL_PROVIDER === "resend" ? resendAdapter : consoleAdapter;
}

export async function sendEmail(message: EmailPayload): Promise<void> {
  await emailAdapter().send(message);
}
