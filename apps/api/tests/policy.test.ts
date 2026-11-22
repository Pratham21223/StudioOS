import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from "@studioos/shared";

describe("centralized role policy", () => {
  it("grants admins the full permission set", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission("ADMIN", permission)).toBe(true);
    }
  });

  it("reserves organization and member administration for admins", () => {
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.ORGANIZATION_MANAGE)).toBe(false);
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.MEMBERS_INVITE)).toBe(false);
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.MEMBERS_MANAGE)).toBe(false);
    expect(hasPermission("PRODUCER", PERMISSIONS.MEMBERS_VIEW)).toBe(false);
    expect(hasPermission("EDITOR", PERMISSIONS.MEMBERS_VIEW)).toBe(false);
  });

  it("allows project managers to view members and manage delivery", () => {
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.MEMBERS_VIEW)).toBe(true);
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.PROJECTS_MANAGE)).toBe(true);
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.CLIENTS_MANAGE)).toBe(true);
  });

  it("keeps editors out of content creation and workflow transitions", () => {
    expect(hasPermission("EDITOR", PERMISSIONS.CONTENT_VIEW)).toBe(true);
    expect(hasPermission("EDITOR", PERMISSIONS.ASSETS_UPLOAD)).toBe(true);
    expect(hasPermission("EDITOR", PERMISSIONS.CONTENT_CREATE)).toBe(false);
    expect(hasPermission("EDITOR", PERMISSIONS.CONTENT_TRANSITION)).toBe(false);
  });

  it("does not expose an unknown role as implicitly permitted", () => {
    expect(Object.keys(ROLE_PERMISSIONS)).toEqual([
      "ADMIN",
      "PROJECT_MANAGER",
      "PRODUCER",
      "EDITOR",
    ]);
  });
});
