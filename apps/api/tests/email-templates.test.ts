import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  invitationEmail,
  notificationEmail,
  passwordResetEmail,
  verificationCodeEmail,
} from "../src/infrastructure/email/templates.js";

describe("email templates", () => {
  it("renders a branded verification code email with text and HTML", () => {
    const email = verificationCodeEmail({
      name: "Ada <Admin>",
      code: "123456",
      expiresInMinutes: 10,
    });

    expect(email.subject).toBe("Your StudioOS verification code");
    expect(email.text).toContain("123456");
    expect(email.html).toContain("123456");
    expect(email.html).toContain("StudioOS");
    expect(email.html).toContain("Ada &lt;Admin&gt;");
    expect(email.html).toContain("expires in 10 minutes");
  });

  it("renders a password reset link with a plain-text fallback", () => {
    const email = passwordResetEmail({
      name: "Ada",
      resetUrl: "https://app.example.com/password/reset?token=abc&next=login",
      expiresInMinutes: 60,
    });

    expect(email.text).toContain("token=abc&next=login");
    expect(email.html).toContain("token=abc&amp;next=login");
    expect(email.html).toContain("Reset password");
  });

  it("renders workspace and client-portal invitations", () => {
    const internal = invitationEmail({
      organizationName: "Acme Studio",
      role: "PROJECT_MANAGER",
      inviteUrl: "https://app.example.com/invitations/abc",
      expiresInHours: 168,
    });
    expect(internal.subject).toContain("Acme Studio");
    expect(internal.text).toContain("Project Manager");

    const client = invitationEmail({
      organizationName: "Acme Studio",
      clientName: "Big Client",
      inviteUrl: "https://app.example.com/invitations/def",
      expiresInHours: 168,
    });
    expect(client.subject).toContain("Big Client");
    expect(client.html).toContain("Big Client");
  });

  it("renders notifications and escapes user-controlled content", () => {
    const email = notificationEmail({
      name: "Ada",
      title: "Task <script>alert(1)</script>",
      body: "A line\nwith <b>markup</b>",
      url: "https://app.example.com/orgs/1/tasks",
    });

    expect(email.subject).toContain("<script>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A line<br />with &lt;b&gt;markup&lt;/b&gt;");
    expect(email.html).toContain("Open in StudioOS");
  });

  it("escapes all HTML-sensitive characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
