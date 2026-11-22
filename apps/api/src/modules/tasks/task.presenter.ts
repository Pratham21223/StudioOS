import { presentUser } from "../../shared/presenters.js";
import type { TaskWithRelations } from "./task.repository.js";

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function presentTask(task: TaskWithRelations) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: dateOnly(task.dueDate),
    project: {
      id: task.project.id,
      name: task.project.name,
      status: task.project.status,
      client: task.project.client,
    },
    contentItem: task.contentItem
      ? {
          id: task.contentItem.id,
          title: task.contentItem.title,
          status: task.contentItem.status,
        }
      : null,
    assignee: task.assignee ? presentUser(task.assignee) : null,
    createdBy: task.createdBy ? presentUser(task.createdBy) : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
