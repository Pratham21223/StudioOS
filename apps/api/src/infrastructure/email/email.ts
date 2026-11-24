import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors.js";
import type { EmailPayload } from "../../modules/notifications/notification.service.js";

export type EmailAdapter = {
  send(message: EmailPayload): Promise<void>;
};

export type ParsedFromAddress = {
  name: string;
  email: string;
};

/**
 * Accepts either `Name <email@example.com>` or a bare address.
 */
export function parseEmailFrom(value: string): ParsedFromAddress {
  const trimmed = value.trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(trimmed);
  const email = match?.[2]?.trim() || trimmed;
  const name = match?.[1]?.trim() || "StudioOS";
  return { name, email };
}

function requireFrom(): string {
  if (!env.EMAIL_FROM) {
    throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Email delivery requires EMAIL_FROM.");
  }
  return env.EMAIL_FROM;
}

const consoleAdapter: EmailAdapter = {
  async send(message) {
    // Never log the body: invitation, reset, and OTP codes are credentials.
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
        ...(message.html ? { html: message.html } : {}),
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

const brevoAdapter: EmailAdapter = {
  async send(message) {
    if (!env.BREVO_API_KEY || !env.EMAIL_FROM) {
      throw new AppError(
        503,
        "EMAIL_NOT_CONFIGURED",
        "Brevo email delivery requires BREVO_API_KEY and EMAIL_FROM.",
      );
    }

    const from = parseEmailFrom(env.EMAIL_FROM);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: from,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        ...(message.html ? { htmlContent: message.html } : {}),
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Brevo delivery failed (${response.status}): ${detail}`);
    }
  },
};

let smtpTransporter: Transporter | null = null;

function smtpTransport(): Transporter {
  if (!env.SMTP_HOST) {
    throw new AppError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "SMTP email delivery requires SMTP_HOST and EMAIL_FROM.",
    );
  }
  if (env.SMTP_USER && !env.SMTP_PASSWORD) {
    throw new AppError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "SMTP authentication requires SMTP_USER and SMTP_PASSWORD.",
    );
  }

  smtpTransporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return smtpTransporter;
}

const smtpAdapter: EmailAdapter = {
  async send(message) {
    await smtpTransport().sendMail({
      from: requireFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
  },
};

export function emailAdapter(): EmailAdapter {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      return resendAdapter;
    case "brevo":
      return brevoAdapter;
    case "smtp":
      return smtpAdapter;
    default:
      return consoleAdapter;
  }
}

export async function sendEmail(message: EmailPayload): Promise<void> {
  await emailAdapter().send(message);
}
