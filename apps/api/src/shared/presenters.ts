import type { Organization, OrganizationMembership, User } from "@prisma/client";

type UserRecord = Pick<User, "id" | "name" | "email" | "status" | "createdAt">;
type OrganizationRecord = Pick<Organization, "id" | "name" | "slug" | "status" | "createdAt">;
type MembershipRecord = Pick<OrganizationMembership, "id" | "role" | "status" | "createdAt">;

export function presentUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
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
