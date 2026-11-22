import type { User, WorkflowEvent } from "@prisma/client";
import { presentUser } from "../../shared/presenters.js";
import type { ContentWithRelations } from "./content.repository.js";

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function presentContent(content: ContentWithRelations) {
  return {
    id: content.id,
    title: content.title,
    description: content.description,
    type: content.type,
    status: content.status,
    deadline: dateOnly(content.deadline),
    version: content.version,
    project: {
      id: content.project.id,
      name: content.project.name,
      status: content.project.status,
      client: content.project.client,
    },
    assignee: content.assignee ? presentUser(content.assignee) : null,
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
  };
}

export function presentWorkflowEvent(event: WorkflowEvent & { actor: User | null }) {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note,
    actor: event.actor ? presentUser(event.actor) : null,
    createdAt: event.createdAt.toISOString(),
  };
}
