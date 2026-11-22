import { beforeEach, describe, expect, it } from "vitest";
import {
  addInternalMember,
  createClientRecord,
  createContentRecord,
  createProjectRecord,
  createTaskRecord,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function setupTaskProject(organizationName = "Alpha Studio", email = "alpha@example.com") {
  const alpha = await setupOrganization(organizationName, email);
  const client = await createClientRecord(alpha.client, alpha.organization.id, {
    name: `${organizationName} Client`,
  });
  const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
    name: `${organizationName} Project`,
  });
  return { alpha, client, project };
}

describe("task management", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates, filters, updates, and completes tasks", async () => {
    const { alpha, project } = await setupTaskProject();
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );

    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Episode 02",
    });

    const overdue = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      contentItemId: content.id,
      title: "Research the cold open",
      description: "Pull three reference clips.",
      priority: "HIGH",
      dueDate: dateOffset(-2),
      assigneeId: producer.auth.user.id,
    });
    expect(overdue.status).toBe("TODO");
    expect(overdue.priority).toBe("HIGH");
    expect(overdue.dueDate).toBe(dateOffset(-2));
    expect(overdue.contentItem?.id).toBe(content.id);
    expect(overdue.contentItem?.title).toBe("Episode 02");
    expect(overdue.assignee?.email).toBe("producer@alpha.test");
    expect(overdue.createdBy?.email).toBe("alpha@example.com");

    const future = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Book the studio",
      priority: "LOW",
      dueDate: dateOffset(5),
    });

    const doneOverdue = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Old done task",
      status: "DONE",
      dueDate: dateOffset(-5),
    });

    const list = await alpha.client.get(`/api/v1/organizations/${alpha.organization.id}/tasks`);
    expect(list.status).toBe(200);
    expect(list.body.tasks).toHaveLength(3);

    const overdueList = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?overdue=true`,
    );
    expect(overdueList.body.tasks).toHaveLength(1);
    expect(overdueList.body.tasks[0].id).toBe(overdue.id);

    const byStatus = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?status=DONE`,
    );
    expect(byStatus.body.tasks).toHaveLength(1);
    expect(byStatus.body.tasks[0].id).toBe(doneOverdue.id);

    const byPriority = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?priority=HIGH`,
    );
    expect(byPriority.body.tasks).toHaveLength(1);

    const byProject = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?projectId=${project.id}`,
    );
    expect(byProject.body.tasks).toHaveLength(3);

    const byContent = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?contentItemId=${content.id}`,
    );
    expect(byContent.body.tasks).toHaveLength(1);

    const byAssignee = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?assigneeId=me`,
    );
    expect(byAssignee.body.tasks).toHaveLength(0);

    const producerMine = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?assigneeId=me`,
    );
    expect(producerMine.body.tasks).toHaveLength(1);
    expect(producerMine.body.tasks[0].id).toBe(overdue.id);

    const search = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?search=studio`,
    );
    expect(search.body.tasks).toHaveLength(1);
    expect(search.body.tasks[0].id).toBe(future.id);

    const statusUpdate = await producer.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${overdue.id}/status`,
      { status: "IN_PROGRESS" },
    );
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.task.status).toBe("IN_PROGRESS");

    const clearedOverdue = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?overdue=true`,
    );
    expect(clearedOverdue.body.tasks).toHaveLength(1);

    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${overdue.id}/status`,
      { status: "DONE" },
    );
    const noOverdue = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks?overdue=true`,
    );
    expect(noOverdue.body.tasks).toHaveLength(0);

    const update = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${future.id}`,
      {
        title: "Book the studio and engineer",
        priority: "URGENT",
        dueDate: dateOffset(3),
        assigneeId: producer.auth.user.id,
        contentItemId: content.id,
      },
    );
    expect(update.status).toBe(200);
    expect(update.body.task.title).toBe("Book the studio and engineer");
    expect(update.body.task.priority).toBe("URGENT");
    expect(update.body.task.dueDate).toBe(dateOffset(3));
    expect(update.body.task.assignee.id).toBe(producer.auth.user.id);
    expect(update.body.task.contentItem.id).toBe(content.id);

    const detail = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${future.id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.task.contentItem.title).toBe("Episode 02");
  });

  it("lets assignees update their own task status but not manage other tasks", async () => {
    const { alpha, project } = await setupTaskProject();
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    const editor = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "editor@alpha.test",
      "EDITOR",
      "Elena Editor",
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id, editor.auth.user.id] },
    );

    const editorTask = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Edit the cold open",
      assigneeId: editor.auth.user.id,
    });
    const adminTask = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Approve the cut",
      assigneeId: alpha.auth.user.id,
    });

    const ownStatus = await editor.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${editorTask.id}/status`,
      { status: "IN_PROGRESS" },
    );
    expect(ownStatus.status).toBe(200);
    expect(ownStatus.body.task.status).toBe("IN_PROGRESS");

    const otherStatus = await editor.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${adminTask.id}/status`,
      { status: "DONE" },
    );
    expect(otherStatus.status).toBe(403);
    expect(otherStatus.body.error.code).toBe("TASK_STATUS_FORBIDDEN");

    const editorCreate = await editor.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      { projectId: project.id, title: "Editor Task" },
    );
    expect(editorCreate.status).toBe(403);

    const editorPatch = await editor.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${editorTask.id}`,
      { priority: "URGENT" },
    );
    expect(editorPatch.status).toBe(403);

    const producerCreate = await createTaskRecord(producer.client, alpha.organization.id, {
      projectId: project.id,
      title: "Producer Task",
    });
    expect(producerCreate.title).toBe("Producer Task");
    expect(producerCreate.createdBy?.email).toBe("producer@alpha.test");

    const managerStatus = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${editorTask.id}/status`,
      { status: "DONE" },
    );
    expect(managerStatus.status).toBe(200);

    const unassigned = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Unassigned Task",
    });
    const editorUnassigned = await editor.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${unassigned.id}/status`,
      { status: "IN_PROGRESS" },
    );
    expect(editorUnassigned.status).toBe(403);
  });

  it("validates tenant, project, content, and assignee boundaries", async () => {
    const { alpha, project } = await setupTaskProject();
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const secondClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Second Client",
    });
    const secondProject = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      secondClient.id,
      { name: "Second Project" },
    );
    const otherContent = await createContentRecord(
      alpha.client,
      alpha.organization.id,
      secondProject.id,
      { title: "Other Project Content" },
    );

    const crossTenantProject = await beta.client.post(
      `/api/v1/organizations/${beta.organization.id}/tasks`,
      { projectId: project.id, title: "Cross Tenant Task" },
    );
    expect(crossTenantProject.status).toBe(404);

    const task = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Scoped Task",
    });

    const crossTenantRead = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/tasks/${task.id}`,
    );
    expect(crossTenantRead.status).toBe(404);

    const crossProjectContent = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      {
        projectId: project.id,
        contentItemId: otherContent.id,
        title: "Wrong Content",
      },
    );
    expect(crossProjectContent.status).toBe(400);
    expect(crossProjectContent.body.error.code).toBe("INVALID_TASK_CONTENT");

    const crossTenantAssignee = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      {
        projectId: project.id,
        title: "Cross Assignee",
        assigneeId: beta.auth.user.id,
      },
    );
    expect(crossTenantAssignee.status).toBe(400);
    expect(crossTenantAssignee.body.error.code).toBe("INVALID_ASSIGNEE");

    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    const offProject = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      {
        projectId: project.id,
        title: "Off Project",
        assigneeId: producer.auth.user.id,
      },
    );
    expect(offProject.status).toBe(400);
    expect(offProject.body.error.code).toBe("ASSIGNEE_NOT_ON_PROJECT");

    const producerCreate = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      { projectId: project.id, title: "No Project Access" },
    );
    expect(producerCreate.status).toBe(404);

    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );

    const assigned = await createTaskRecord(producer.client, alpha.organization.id, {
      projectId: project.id,
      title: "Now Assignable",
      assigneeId: producer.auth.user.id,
    });
    expect(assigned.assignee?.id).toBe(producer.auth.user.id);

    const deactivate = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${producer.membership.id}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivate.status).toBe(200);

    const inactiveAssignee = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      {
        projectId: project.id,
        title: "Inactive Assignee",
        assigneeId: producer.auth.user.id,
      },
    );
    expect(inactiveAssignee.status).toBe(400);
    expect(inactiveAssignee.body.error.code).toBe("INVALID_ASSIGNEE");
  });

  it("blocks task mutations on completed projects while allowing paused work", async () => {
    const { alpha, project } = await setupTaskProject();

    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "PAUSED" },
    );

    const pausedTask = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Paused Project Task",
    });
    expect(pausedTask.status).toBe("TODO");

    const statusOnPaused = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${pausedTask.id}/status`,
      { status: "IN_PROGRESS" },
    );
    expect(statusOnPaused.status).toBe(200);

    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "COMPLETED" },
    );

    const createOnCompleted = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/tasks`,
      { projectId: project.id, title: "Late Task" },
    );
    expect(createOnCompleted.status).toBe(409);
    expect(createOnCompleted.body.error.code).toBe("PROJECT_COMPLETED");

    const updateOnCompleted = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${pausedTask.id}`,
      { title: "Late Rename" },
    );
    expect(updateOnCompleted.status).toBe(409);

    const statusOnCompleted = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${pausedTask.id}/status`,
      { status: "DONE" },
    );
    expect(statusOnCompleted.status).toBe(409);
  });
});
