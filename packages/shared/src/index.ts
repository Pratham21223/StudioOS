/**
 * Shared domain vocabulary. This package intentionally contains no secrets and
 * no backend-only logic; the web app uses role labels, and the API uses the
 * permission matrix as the single source of authorization policy.
 */

export const ORG_ROLES = ["ADMIN", "PROJECT_MANAGER", "PRODUCER", "EDITOR"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  PRODUCER: "Producer",
  EDITOR: "Editor",
};

export const ORG_ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  ADMIN: "Full control over the workspace, members, clients, and projects.",
  PROJECT_MANAGER: "Manages clients, projects, and internal delivery teams.",
  PRODUCER: "Plans and produces content on authorized projects.",
  EDITOR: "Works on assigned content and tasks.",
};

export const PERMISSIONS = {
  ORGANIZATION_VIEW: "ORGANIZATION_VIEW",
  ORGANIZATION_MANAGE: "ORGANIZATION_MANAGE",
  MEMBERS_VIEW: "MEMBERS_VIEW",
  MEMBERS_MANAGE: "MEMBERS_MANAGE",
  MEMBERS_INVITE: "MEMBERS_INVITE",
  CLIENTS_VIEW: "CLIENTS_VIEW",
  CLIENTS_MANAGE: "CLIENTS_MANAGE",
  PROJECTS_VIEW: "PROJECTS_VIEW",
  PROJECTS_MANAGE: "PROJECTS_MANAGE",
  CONTENT_VIEW: "CONTENT_VIEW",
  CONTENT_CREATE: "CONTENT_CREATE",
  CONTENT_TRANSITION: "CONTENT_TRANSITION",
  TASKS_VIEW: "TASKS_VIEW",
  TASKS_CREATE: "TASKS_CREATE",
  ASSETS_UPLOAD: "ASSETS_UPLOAD",
  REVIEWS_INTERNAL: "REVIEWS_INTERNAL",
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  DASHBOARD_ORG: "DASHBOARD_ORG",
  AUDIT_VIEW: "AUDIT_VIEW",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const INTERNAL_CONTRIBUTOR: Permission[] = [
  PERMISSIONS.ORGANIZATION_VIEW,
  PERMISSIONS.PROJECTS_VIEW,
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.TASKS_VIEW,
  PERMISSIONS.DASHBOARD_VIEW,
];

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(ALL_PERMISSIONS),
  PROJECT_MANAGER: new Set([
    ...INTERNAL_CONTRIBUTOR,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.CLIENTS_MANAGE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_TRANSITION,
    PERMISSIONS.TASKS_CREATE,
    PERMISSIONS.ASSETS_UPLOAD,
    PERMISSIONS.REVIEWS_INTERNAL,
    PERMISSIONS.DASHBOARD_ORG,
  ]),
  PRODUCER: new Set([
    ...INTERNAL_CONTRIBUTOR,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_TRANSITION,
    PERMISSIONS.TASKS_CREATE,
    PERMISSIONS.ASSETS_UPLOAD,
    PERMISSIONS.REVIEWS_INTERNAL,
  ]),
  EDITOR: new Set([
    ...INTERNAL_CONTRIBUTOR,
    PERMISSIONS.ASSETS_UPLOAD,
    PERMISSIONS.REVIEWS_INTERNAL,
  ]),
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
