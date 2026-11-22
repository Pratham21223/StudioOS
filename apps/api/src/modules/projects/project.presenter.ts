import type { Project, ProjectMembership, User } from "@prisma/client";
import { presentClientBrief, presentUser } from "../../shared/presenters.js";

type ProjectRecord = Pick<
  Project,
  "id" | "name" | "description" | "status" | "startDate" | "deadline" | "createdAt" | "updatedAt"
>;

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function presentProject(
  project: ProjectRecord & {
    client: { id: string; name: string; status: "ACTIVE" | "ARCHIVED" };
    _count: { memberships: number };
  },
) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: dateOnly(project.startDate),
    deadline: dateOnly(project.deadline),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    client: presentClientBrief(project.client),
    memberCount: project._count.memberships,
  };
}

export function presentProjectMember(
  membership: Pick<ProjectMembership, "id" | "createdAt"> & { user: User },
) {
  return {
    id: membership.id,
    createdAt: membership.createdAt.toISOString(),
    user: presentUser(membership.user),
  };
}
