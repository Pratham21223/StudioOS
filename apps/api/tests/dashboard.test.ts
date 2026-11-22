import { beforeEach, describe, expect, it } from "vitest";
import {
  addInternalMember,
  createClientRecord,
  createContentRecord,
  createProjectRecord,
  createTaskRecord,
  resetDatabase,
  setupOrganization,
  transitionContentRecord,
} from "./helpers.js";

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("role-aware dashboard", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("scopes counts, approvals, tasks, and overdue work by role", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const clientOne = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Dashboard Client One",
    });
    const clientTwo = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Dashboard Client Two",
    });
    const projectOne = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      clientOne.id,
      { name: "Dashboard Project One" },
    );
    const projectTwo = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      clientTwo.id,
      { name: "Dashboard Project Two" },
    );
    const contentOne = await createContentRecord(
      alpha.client,
      alpha.organization.id,
      projectOne.id,
      { title: "Dashboard Content One" },
    );
    await createContentRecord(alpha.client, alpha.organization.id, projectTwo.id, {
      title: "Dashboard Content Two",
    });

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
      `/api/v1/organizations/${alpha.organization.id}/projects/${projectOne.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${projectTwo.id}/members`,
      { userIds: [editor.auth.user.id] },
    );

    await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: projectOne.id,
      title: "Producer overdue task",
      assigneeId: producer.auth.user.id,
      dueDate: dateOffset(-2),
      priority: "HIGH",
    });
    await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: projectTwo.id,
      title: "Editor overdue task",
      assigneeId: editor.auth.user.id,
      dueDate: dateOffset(-1),
      priority: "URGENT",
    });
    await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: projectTwo.id,
      title: "Admin overdue task",
      assigneeId: alpha.auth.user.id,
      dueDate: dateOffset(-3),
    });

    for (const status of [
      "SCRIPT",
      "SHOOT",
      "EDITING",
      "INTERNAL_REVIEW",
      "CLIENT_APPROVAL",
    ] as const) {
      const response = await transitionContentRecord(
        alpha.client,
        alpha.organization.id,
        contentOne.id,
        status,
      );
      expect(response.status).toBe(200);
    }

    const manager = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/dashboard`,
    );
    expect(manager.status).toBe(200);
    const managerData = manager.body.dashboard;
    expect(managerData.scope).toBe("ORGANIZATION");
    expect(managerData.counts.activeProjects).toBe(2);
    expect(managerData.counts.awaitingApproval).toBe(1);
    expect(managerData.counts.overdueTasks).toBe(3);
    expect(managerData.awaitingApproval[0].id).toBe(contentOne.id);
    expect(managerData.projects).toHaveLength(2);
    expect(
      managerData.contentByStatus.find(
        (entry: { status: string }) => entry.status === "CLIENT_APPROVAL",
      ).count,
    ).toBe(1);

    const producerDashboard = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/dashboard`,
    );
    expect(producerDashboard.status).toBe(200);
    const producerData = producerDashboard.body.dashboard;
    expect(producerData.scope).toBe("PROJECTS");
    expect(producerData.counts.activeProjects).toBe(1);
    expect(producerData.counts.awaitingApproval).toBe(1);
    expect(producerData.counts.overdueTasks).toBe(1);
    expect(producerData.counts.myOpenTasks).toBe(1);
    expect(producerData.myTasks[0].title).toBe("Producer overdue task");
    expect(producerData.overdueTasks[0].title).toBe("Producer overdue task");
    expect(producerData.projects[0].id).toBe(projectOne.id);

    const editorDashboard = await editor.client.get(
      `/api/v1/organizations/${alpha.organization.id}/dashboard`,
    );
    const editorData = editorDashboard.body.dashboard;
    expect(editorData.counts.activeProjects).toBe(1);
    expect(editorData.counts.awaitingApproval).toBe(0);
    expect(editorData.counts.overdueTasks).toBe(1);
    expect(editorData.myTasks[0].title).toBe("Editor overdue task");
    expect(editorData.awaitingApproval).toHaveLength(0);

    const crossTenant = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/dashboard`,
    );
    expect(crossTenant.status).toBe(200);
    expect(crossTenant.body.dashboard.counts.activeProjects).toBe(0);
    expect(crossTenant.body.dashboard.projects).toHaveLength(0);
  });
});
