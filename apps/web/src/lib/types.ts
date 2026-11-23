import type {
  ContentStatus as SharedContentStatus,
  ContentType as SharedContentType,
  OrgRole,
  TaskPriority as SharedTaskPriority,
  TaskStatus as SharedTaskStatus,
} from "@studioos/shared";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
};

export type Membership = {
  id: string;
  role: OrgRole;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  organization: Organization;
};

export type User = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "DEACTIVATED";
  emailVerified: boolean;
  createdAt: string;
};

export type ClientStatus = "ACTIVE" | "ARCHIVED";

export type ClientBrief = {
  id: string;
  name: string;
  status: ClientStatus;
};

export type Client = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  brandGuidelines: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
  memberCount: number;
};

export type ClientMembershipSummary = {
  id: string;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  client: ClientBrief;
  organization: Organization;
};

export type ClientMember = {
  id: string;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  user: User;
};

export type MeResponse = {
  user: User;
  memberships: Membership[];
  clientMemberships: ClientMembershipSummary[];
};

export type AuthResponse = MeResponse & {
  csrfToken: string;
};

export type RegisterPendingResponse = {
  message: string;
  email: string;
  expiresInMinutes: number;
  resendAfterSeconds: number;
  devCode?: string;
};

export type ResendVerificationResponse = {
  message: string;
  expiresInMinutes: number;
  resendAfterSeconds: number;
  devCode?: string;
};

export type OAuthProviderSummary = {
  id: "google" | "github";
  label: string;
};

export type OAuthProvidersResponse = {
  providers: OAuthProviderSummary[];
};

export type Member = {
  id: string;
  role: OrgRole;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  user: User;
};

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
export type InvitationType = "INTERNAL" | "CLIENT";

export type Invitation = {
  id: string;
  email: string;
  type: InvitationType;
  role: OrgRole | null;
  clientId: string | null;
  client: ClientBrief | null;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type InvitationPreview = {
  organization: Organization;
  client: ClientBrief | null;
  email: string;
  type: InvitationType;
  role: OrgRole | null;
  expiresAt: string;
  status: InvitationStatus;
};

export type AcceptInvitationResponse = MeResponse & {
  csrfToken: string;
};

export type CreateInvitationResponse = {
  invitation: Invitation;
  inviteUrl?: string;
};

export type OrganizationResponse = {
  organization: Organization;
  membership: {
    id: string;
    role: OrgRole;
    status: "ACTIVE";
  };
};

export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  client: ClientBrief;
  memberCount: number;
};

export type ProjectMember = {
  id: string;
  createdAt: string;
  user: User;
};

export type ContentType = SharedContentType;
export type ContentStatus = SharedContentStatus;

export type ContentItem = {
  id: string;
  title: string;
  description: string | null;
  type: ContentType;
  status: ContentStatus;
  deadline: string | null;
  version: number;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    client: { id: string; name: string };
  };
  assignee: User | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowEvent = {
  id: string;
  fromStatus: ContentStatus;
  toStatus: ContentStatus;
  note: string | null;
  actor: User | null;
  createdAt: string;
};

export type TaskStatus = SharedTaskStatus;
export type TaskPriority = SharedTaskPriority;

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    client: { id: string; name: string };
  };
  contentItem: {
    id: string;
    title: string;
    status: ContentStatus;
  } | null;
  assignee: User | null;
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
  };
  contentItem: {
    id: string;
    title: string;
    status: ContentStatus;
  } | null;
  uploadedBy: User | null;
  createdAt: string;
};

export type ReviewDecision = "INTERNAL_FEEDBACK" | "CLIENT_APPROVED" | "CLIENT_REVISION_REQUESTED";

export type Review = {
  id: string;
  decision: ReviewDecision;
  contentVersion: number;
  feedback: string | null;
  reviewer: User | null;
  asset: {
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
  content: {
    id: string;
    title: string;
    status: ContentStatus;
  };
  project: {
    id: string;
    name: string;
  };
  createdAt: string;
};

export type NotificationType =
  | "TASK_ASSIGNED"
  | "CONTENT_ASSIGNED"
  | "CONTENT_SUBMITTED"
  | "REVIEW_FEEDBACK"
  | "CONTENT_APPROVED"
  | "REVISION_REQUESTED"
  | "DEADLINE_REMINDER"
  | "INVITATION";

export type Notification = {
  id: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type DashboardContentStatusCount = {
  status: ContentStatus;
  count: number;
};

export type DashboardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string };
  contentItem: { id: string; title: string } | null;
};

export type DashboardOverdueTask = Omit<DashboardTask, "contentItem">;

export type DashboardProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  client: { id: string; name: string };
  taskCount: number;
  contentByStatus: DashboardContentStatusCount[];
};

export type Dashboard = {
  scope: "ORGANIZATION" | "PROJECTS";
  counts: {
    activeProjects: number;
    activeContent: number;
    awaitingApproval: number;
    openTasks: number;
    overdueTasks: number;
    unreadNotifications: number;
  };
  contentByStatus: DashboardContentStatusCount[];
  awaitingApproval: Array<{
    id: string;
    title: string;
    deadline: string | null;
    version: number;
    updatedAt: string;
    project: { id: string; name: string };
  }>;
  openTasks: DashboardTask[];
  overdueTasks: DashboardOverdueTask[];
  projects: DashboardProject[];
};

export type PortalAsset = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type PortalReview = {
  id: string;
  decision: ReviewDecision;
  contentVersion: number;
  feedback: string | null;
  reviewer: { id: string; name: string; email: string } | null;
  asset: { id: string; originalFilename: string } | null;
  createdAt: string;
};

export type PortalProject = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  client: { id: string; name: string; status: ClientStatus };
  visibleContentCount: number;
  awaitingReviewCount: number;
  createdAt: string;
};

export type PortalContent = {
  id: string;
  title: string;
  description: string | null;
  type: ContentType;
  status: ContentStatus;
  deadline: string | null;
  version: number;
  project: {
    id: string;
    name: string;
    client: { id: string; name: string };
  };
  assets: PortalAsset[];
  reviews: PortalReview[];
  updatedAt: string;
  createdAt: string;
};
