import { CONTENT_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@studioos/shared";
import { Badge } from "./ui";
import type {
  ClientStatus,
  ContentStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "../lib/types";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
      {status === "ACTIVE" ? "Active" : "Archived"}
    </Badge>
  );
}

const projectTones: Record<ProjectStatus, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "neutral",
};

const projectLabels: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={projectTones[status]}>{projectLabels[status]}</Badge>;
}

const contentTones: Record<ContentStatus, "neutral" | "accent" | "success" | "warning" | "danger"> =
  {
    BRIEF: "neutral",
    SCRIPT: "accent",
    SHOOT: "accent",
    EDITING: "warning",
    INTERNAL_REVIEW: "warning",
    CLIENT_APPROVAL: "danger",
    READY_TO_PUBLISH: "success",
  };

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <Badge tone={contentTones[status]}>{CONTENT_STATUS_LABELS[status]}</Badge>;
}

const taskStatusTones: Record<TaskStatus, "neutral" | "accent" | "success" | "danger"> = {
  TODO: "neutral",
  IN_PROGRESS: "accent",
  BLOCKED: "danger",
  DONE: "success",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskStatusTones[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

const taskPriorityTones: Record<TaskPriority, "neutral" | "warning" | "danger" | "accent"> = {
  LOW: "neutral",
  MEDIUM: "neutral",
  HIGH: "warning",
  URGENT: "danger",
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={taskPriorityTones[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>;
}
