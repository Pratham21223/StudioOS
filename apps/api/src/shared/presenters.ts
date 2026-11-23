import type {
  Client,
  ClientMembership,
  Organization,
  OrganizationMembership,
  User,
} from "@prisma/client";

type UserRecord = Pick<User, "id" | "name" | "email" | "status" | "emailVerifiedAt" | "createdAt">;
type OrganizationRecord = Pick<Organization, "id" | "name" | "slug" | "status" | "createdAt">;
type ClientRecord = Pick<
  Client,
  | "id"
  | "name"
  | "contactName"
  | "email"
  | "phone"
  | "website"
  | "notes"
  | "brandGuidelines"
  | "status"
  | "createdAt"
  | "updatedAt"
>;
type ClientMembershipRecord = Pick<ClientMembership, "id" | "status" | "createdAt">;
type MembershipRecord = Pick<OrganizationMembership, "id" | "role" | "status" | "createdAt">;

export function presentUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
  };
}

export function presentOrganization(organization: OrganizationRecord) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    createdAt: organization.createdAt.toISOString(),
  };
}

export function presentMembershipWithOrganization(
  membership: MembershipRecord & { organization: OrganizationRecord },
) {
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
    organization: presentOrganization(membership.organization),
  };
}

export function presentMembershipWithUser(membership: MembershipRecord & { user: UserRecord }) {
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
    user: presentUser(membership.user),
  };
}

export function presentClientBrief(client: Pick<Client, "id" | "name" | "status">) {
  return {
    id: client.id,
    name: client.name,
    status: client.status,
  };
}

export function presentClient(
  client: ClientRecord,
  counts?: { projects: number; members: number },
) {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website,
    notes: client.notes,
    brandGuidelines: client.brandGuidelines,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    ...(counts ? { projectCount: counts.projects, memberCount: counts.members } : {}),
  };
}

export function presentClientMembershipWithUser(
  membership: ClientMembershipRecord & { user: UserRecord },
) {
  return {
    id: membership.id,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
    user: presentUser(membership.user),
  };
}

export function presentClientMembershipWithClient(
  membership: ClientMembershipRecord & {
    client: Pick<Client, "id" | "name" | "status">;
    organization: OrganizationRecord;
  },
) {
  return {
    id: membership.id,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
    client: presentClientBrief(membership.client),
    organization: presentOrganization(membership.organization),
  };
}
