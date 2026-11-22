import type { OrgRole } from "@studioos/shared";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "DEACTIVATED";
};

export type AuthContext = {
  sessionId: string;
  userId: string;
  user: AuthUser;
};

export type TenantContext = {
  organizationId: string;
  membershipId: string;
  role: OrgRole;
  organization: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "DEACTIVATED";
  };
};
