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
