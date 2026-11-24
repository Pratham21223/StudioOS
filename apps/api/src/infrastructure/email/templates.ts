export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

type LayoutInput = {
  preheader: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  note?: string;
};

const COLORS = {
  page: "#f4f0e8",
  card: "#ffffff",
  border: "#e7dfd2",
  ink: "#1d1c1a",
  muted: "#6f685e",
  subtle: "#9a9184",
  accent: "#e2562f",
  accentSoft: "#fdf3ee",
  footer: "#faf7f2",
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function paragraph(value: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${COLORS.muted};">${escapeHtml(value)}</p>`;
}

function multiline(value: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${COLORS.muted};">${escapeHtml(
    value,
  ).replace(/\n/g, "<br />")}</p>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;">
  <tr>
    <td style="border-radius:10px;background:${COLORS.ink};">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:600;line-height:1;color:${COLORS.page};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

function fallbackLink(url: string): string {
  return `<p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:${COLORS.subtle};word-break:break-all;">If the button does not work, copy this link:<br /><a href="${escapeHtml(url)}" style="color:${COLORS.accent};text-decoration:underline;">${escapeHtml(url)}</a></p>`;
}

function layout(input: LayoutInput): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT_STACK};color:${COLORS.ink};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0;font-family:${FONT_STACK};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.ink};">StudioOS<span style="color:${COLORS.accent};">.</span></p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 10px;">
                <p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.accent};">${escapeHtml(input.eyebrow)}</p>
                <h1 style="margin:0 0 18px;font-family:${FONT_STACK};font-size:28px;line-height:1.2;letter-spacing:-0.02em;color:${COLORS.ink};">${escapeHtml(input.heading)}</h1>
                ${input.bodyHtml}
                ${input.cta ? button(input.cta.label, input.cta.url) : ""}
                ${input.cta ? fallbackLink(input.cta.url) : ""}
              </td>
            </tr>
            ${
              input.note
                ? `<tr>
              <td style="padding:8px 32px 30px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${COLORS.subtle};">${escapeHtml(input.note)}</p>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:20px 32px;background:${COLORS.footer};border-top:1px solid ${COLORS.border};">
                <p style="margin:0 0 4px;font-size:11px;line-height:1.6;color:${COLORS.subtle};">StudioOS · Content production, in one place.</p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:${COLORS.subtle};">If you were not expecting this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function verificationCodeEmail(input: {
  name: string;
  code: string;
  expiresInMinutes: number;
}): EmailContent {
  const codeBlock = `<div style="margin:20px 0;padding:18px 16px;border:1px dashed ${COLORS.accent};background:${COLORS.accentSoft};border-radius:12px;text-align:center;font-family:${MONO_STACK};font-size:32px;font-weight:700;letter-spacing:0.32em;color:${COLORS.ink};">${escapeHtml(
    input.code,
  )}</div>`;

  return {
    subject: "Your StudioOS verification code",
    text: `Hi ${input.name},\n\nYour StudioOS verification code is ${input.code}.\n\nEnter it to finish creating your account. The code expires in ${input.expiresInMinutes} minutes.\n\nIf you did not create a StudioOS account, you can ignore this email.`,
    html: layout({
      preheader: `${input.code} is your StudioOS verification code.`,
      eyebrow: "Verify your email",
      heading: "Your verification code",
      bodyHtml: `${paragraph(`Hi ${input.name},`)}${paragraph("Enter this code to finish creating your StudioOS account.")}${codeBlock}${paragraph(`This code expires in ${input.expiresInMinutes} minutes. Never share it with anyone.`)}`,
      note: "If you did not create an account, you can ignore this email.",
    }),
  };
}

export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailContent {
  return {
    subject: "Reset your StudioOS password",
    text: `Hi ${input.name},\n\nReset your StudioOS password: ${input.resetUrl}\n\nThis link expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: layout({
      preheader: "Use this single-use link to choose a new StudioOS password.",
      eyebrow: "Account recovery",
      heading: "Reset your password",
      bodyHtml: `${paragraph(`Hi ${input.name},`)}${paragraph("We received a request to reset your StudioOS password. Use the button below to choose a new one.")}`,
      cta: { label: "Reset password", url: input.resetUrl },
      note: `This link expires in ${input.expiresInMinutes} minutes and can only be used once. If you did not request it, you can ignore this email.`,
    }),
  };
}

export function invitationEmail(input: {
  organizationName: string;
  role?: string | null;
  clientName?: string | null;
  inviteUrl: string;
  expiresInHours: number;
}): EmailContent {
  const client = input.clientName?.trim();
  const heading = client ? `Review work for ${client}` : `Join ${input.organizationName}`;
  const intro = client
    ? `${input.organizationName} invited you to the client portal for ${client} on StudioOS.`
    : `${input.organizationName} invited you to join their StudioOS workspace${
        input.role ? ` as ${roleLabel(input.role)}` : ""
      }.`;

  return {
    subject: client
      ? `${input.organizationName} invited you to review ${client} on StudioOS`
      : `You're invited to ${input.organizationName} on StudioOS`,
    text: `${intro}\n\nAccept the invitation: ${input.inviteUrl}\n\nThis link expires in ${input.expiresInHours} hours.`,
    html: layout({
      preheader: intro,
      eyebrow: "Workspace invitation",
      heading,
      bodyHtml: `${paragraph("Hi,")}${paragraph(intro)}${paragraph("Accepting the invitation takes less than a minute.")}`,
      cta: { label: "Accept invitation", url: input.inviteUrl },
      note: `This invitation expires in ${input.expiresInHours} hours. If you were not expecting it, you can ignore this email.`,
    }),
  };
}

export function notificationEmail(input: {
  name?: string | null;
  title: string;
  body?: string | null;
  url?: string | null;
}): EmailContent {
  const greeting = input.name ? paragraph(`Hi ${input.name},`) : "";

  return {
    subject: input.title,
    text: [
      input.name ? `Hi ${input.name},` : null,
      input.body,
      input.url ? `Open in StudioOS: ${input.url}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: layout({
      preheader: input.title,
      eyebrow: "StudioOS notification",
      heading: input.title,
      bodyHtml: `${greeting}${input.body ? multiline(input.body) : ""}`,
      ...(input.url ? { cta: { label: "Open in StudioOS", url: input.url } } : {}),
      note: "You are receiving this email because of activity in a StudioOS workspace.",
    }),
  };
}
