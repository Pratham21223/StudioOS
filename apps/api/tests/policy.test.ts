import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canPerformContentTransition,
  hasPermission,
  isContentTransitionAllowed,
} from "@studioos/shared";

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
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.CLIENTS_VIEW)).toBe(true);
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.PROJECTS_MANAGE)).toBe(true);
    expect(hasPermission("PROJECT_MANAGER", PERMISSIONS.CLIENTS_MANAGE)).toBe(true);
  });

  it("keeps producers and editors out of the client directory and project management", () => {
    for (const role of ["PRODUCER", "EDITOR"] as const) {
      expect(hasPermission(role, PERMISSIONS.CLIENTS_VIEW)).toBe(false);
      expect(hasPermission(role, PERMISSIONS.CLIENTS_MANAGE)).toBe(false);
      expect(hasPermission(role, PERMISSIONS.PROJECTS_MANAGE)).toBe(false);
      expect(hasPermission(role, PERMISSIONS.PROJECTS_VIEW)).toBe(true);
    }
  });

  it("keeps editors out of content creation but allows limited review submission", () => {
    expect(hasPermission("EDITOR", PERMISSIONS.CONTENT_VIEW)).toBe(true);
    expect(hasPermission("EDITOR", PERMISSIONS.ASSETS_UPLOAD)).toBe(true);
    expect(hasPermission("EDITOR", PERMISSIONS.CONTENT_CREATE)).toBe(false);
    expect(hasPermission("EDITOR", PERMISSIONS.CONTENT_TRANSITION)).toBe(true);
    expect(hasPermission("EDITOR", PERMISSIONS.TASKS_CREATE)).toBe(false);
  });

  it("centralizes the fixed workflow transition policy", () => {
    expect(isContentTransitionAllowed("BRIEF", "SCRIPT")).toBe(true);
    expect(isContentTransitionAllowed("BRIEF", "READY_TO_PUBLISH")).toBe(false);
    expect(isContentTransitionAllowed("READY_TO_PUBLISH", "EDITING")).toBe(false);

    expect(canPerformContentTransition("ADMIN", "CLIENT_APPROVAL", "READY_TO_PUBLISH")).toBe(true);
    expect(
      canPerformContentTransition("PROJECT_MANAGER", "INTERNAL_REVIEW", "CLIENT_APPROVAL"),
    ).toBe(true);
    expect(canPerformContentTransition("PRODUCER", "BRIEF", "SCRIPT")).toBe(true);
    expect(canPerformContentTransition("PRODUCER", "INTERNAL_REVIEW", "CLIENT_APPROVAL")).toBe(
      false,
    );
    expect(canPerformContentTransition("PRODUCER", "CLIENT_APPROVAL", "READY_TO_PUBLISH")).toBe(
      false,
    );
    expect(canPerformContentTransition("EDITOR", "EDITING", "INTERNAL_REVIEW")).toBe(true);
    expect(canPerformContentTransition("EDITOR", "INTERNAL_REVIEW", "EDITING")).toBe(false);
    expect(canPerformContentTransition("EDITOR", "SCRIPT", "SHOOT")).toBe(false);
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
