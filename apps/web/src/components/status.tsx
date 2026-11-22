import { Badge } from "./ui";
import type { ClientStatus, ProjectStatus } from "../lib/types";

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
