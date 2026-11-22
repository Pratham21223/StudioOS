import { useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import type { Membership } from "../../lib/types";

export function useActiveMembership(): Membership | null {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  return memberships.find((membership) => membership.organization.id === orgId) ?? null;
}
