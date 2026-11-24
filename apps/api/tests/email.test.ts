import { describe, expect, it } from "vitest";
import { parseEmailFrom } from "../src/infrastructure/email/email.js";

describe("email configuration", () => {
  it("parses a display name and bare sender address", () => {
    expect(parseEmailFrom("StudioOS <no-reply@example.com>")).toEqual({
      name: "StudioOS",
      email: "no-reply@example.com",
    });
    expect(parseEmailFrom("no-reply@example.com")).toEqual({
      name: "StudioOS",
      email: "no-reply@example.com",
    });
  });

  it("falls back to a default display name", () => {
    expect(parseEmailFrom(" <no-reply@example.com> ")).toEqual({
      name: "StudioOS",
      email: "no-reply@example.com",
    });
  });
});
