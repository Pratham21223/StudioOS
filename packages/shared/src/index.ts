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
    PERMISSIONS.CONTENT_TRANSITION,
    PERMISSIONS.ASSETS_UPLOAD,
    PERMISSIONS.REVIEWS_INTERNAL,
  ]),
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Content production vocabulary and the fixed MVP workflow. The API validates
 * transitions against this table; the UI uses it to render available actions.
 */
export const CONTENT_TYPES = [
  "VIDEO",
  "PODCAST",
  "SOCIAL_POST",
  "ARTICLE",
  "DESIGN",
  "OTHER",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VIDEO: "Video",
  PODCAST: "Podcast",
  SOCIAL_POST: "Social post",
  ARTICLE: "Article",
  DESIGN: "Design",
  OTHER: "Other",
};

export const CONTENT_STATUSES = [
  "BRIEF",
  "SCRIPT",
  "SHOOT",
  "EDITING",
  "INTERNAL_REVIEW",
  "CLIENT_APPROVAL",
  "READY_TO_PUBLISH",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  BRIEF: "Brief",
  SCRIPT: "Script",
  SHOOT: "Shoot",
  EDITING: "Editing",
  INTERNAL_REVIEW: "Internal review",
  CLIENT_APPROVAL: "Client approval",
  READY_TO_PUBLISH: "Ready to publish",
};

export const CONTENT_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  BRIEF: ["SCRIPT"],
  SCRIPT: ["SHOOT"],
  SHOOT: ["EDITING"],
  EDITING: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["EDITING", "CLIENT_APPROVAL"],
  CLIENT_APPROVAL: ["EDITING", "READY_TO_PUBLISH"],
  READY_TO_PUBLISH: [],
};

export function isContentTransitionAllowed(from: ContentStatus, to: ContentStatus): boolean {
  return (CONTENT_TRANSITIONS[from] as readonly ContentStatus[]).includes(to);
}

/**
 * Baseline role policy for internal workflow actions:
 * - Admins and project managers can perform any permitted transition.
 * - Producers own production stages and internal review, but cannot submit to
 *   the client or act on client approval.
 * - Editors can only submit their editing work for internal review.
 */
export function canPerformContentTransition(
  role: OrgRole,
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  if (!isContentTransitionAllowed(from, to)) return false;
  if (role === "ADMIN" || role === "PROJECT_MANAGER") return true;
  if (role === "PRODUCER") {
    return from !== "CLIENT_APPROVAL" && !(from === "INTERNAL_REVIEW" && to === "CLIENT_APPROVAL");
  }
  if (role === "EDITOR") {
    return from === "EDITING" && to === "INTERNAL_REVIEW";
  }
  return false;
}

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ALLOWED_ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AllowedAssetMimeType = (typeof ALLOWED_ASSET_MIME_TYPES)[number];

export function isAllowedAssetMimeType(value: string): boolean {
  return (ALLOWED_ASSET_MIME_TYPES as readonly string[]).includes(value);
}

export const REVIEW_DECISION_LABELS = {
  INTERNAL_FEEDBACK: "Internal feedback",
  CLIENT_APPROVED: "Approved by client",
  CLIENT_REVISION_REQUESTED: "Revision requested",
} as const;

export const NOTIFICATION_TYPE_LABELS = {
  TASK_ASSIGNED: "Task assigned",
  CONTENT_ASSIGNED: "Content assigned",
  CONTENT_SUBMITTED: "Content submitted",
  REVIEW_FEEDBACK: "Review feedback",
  CONTENT_APPROVED: "Content approved",
  REVISION_REQUESTED: "Revision requested",
  DEADLINE_REMINDER: "Deadline reminder",
  INVITATION: "Invitation",
} as const;
