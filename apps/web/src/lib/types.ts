import type { OrgRole } from "@studioos/shared";

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

export type MeResponse = {
  user: User;
  memberships: Membership[];
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

export type Invitation = {
  id: string;
  email: string;
  role: OrgRole;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type InvitationPreview = {
  organization: Organization;
  email: string;
  role: OrgRole;
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
