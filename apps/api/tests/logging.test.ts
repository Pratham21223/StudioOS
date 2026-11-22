import { describe, expect, it } from "vitest";
import { redactSensitivePath } from "../src/shared/request-path.js";

describe("log path redaction", () => {
  it("never emits invitation tokens in request logs", () => {
    expect(redactSensitivePath("/api/v1/invitations/super-secret-token")).toBe(
      "/api/v1/invitations/:token",
    );
    expect(redactSensitivePath("/api/v1/invitations/super-secret-token/extra")).toBe(
      "/api/v1/invitations/:token/extra",
    );
  });

  it("keeps non-secret invitation routes readable", () => {
    expect(redactSensitivePath("/api/v1/invitations/accept")).toBe("/api/v1/invitations/accept");
    expect(redactSensitivePath("/api/v1/invitations")).toBe("/api/v1/invitations");
    expect(redactSensitivePath("/api/v1/organizations/org-id/invitations")).toBe(
      "/api/v1/organizations/org-id/invitations",
    );
  });
});
