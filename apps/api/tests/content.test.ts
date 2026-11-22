import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  PASSWORD,
  addInternalMember,
  createApiClient,
  createClientRecord,
  createContentRecord,
  createProjectRecord,
  inviteClientContact,
  resetDatabase,
  setupOrganization,
  transitionContentRecord,
  type WorkflowEventView,
} from "./helpers.js";

async function setupProject(organizationName = "Alpha Studio", email = "alpha@example.com") {
  const alpha = await setupOrganization(organizationName, email);
  const client = await createClientRecord(alpha.client, alpha.organization.id, {
    name: `${organizationName} Client`,
  });
  const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
    name: `${organizationName} Project`,
  });
  return { alpha, client, project };
}

describe("content items and the fixed workflow", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates content in BRIEF, scopes it by project, and updates metadata", async () => {
    const { alpha, project } = await setupProject();
    const beta = await setupOrganization("Beta Studio", "beta@example.com");

    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Episode 01 — The Long Game",
      description: "Opening episode of the season.",
      type: "PODCAST",
      deadline: "2026-12-12",
    });

    expect(content.status).toBe("BRIEF");
    expect(content.version).toBe(1);
    expect(content.title).toBe("Episode 01 — The Long Game");
    expect(content.deadline).toBe("2026-12-12");
    expect(content.project.id).toBe(project.id);
    expect(content.project.client.name).toBe("Alpha Studio Client");
    expect(content.assignee).toBeNull();

    const list = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items?status=BRIEF&projectId=${project.id}`,
    );
    expect(list.status).toBe(200);
    expect(list.body.content).toHaveLength(1);

    const projectList = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/content-items`,
    );
    expect(projectList.status).toBe(200);
    expect(projectList.body.content).toHaveLength(1);

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

    // Producers and editors cannot reach projects they are not assigned to.
    const inaccessibleCreate = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/content-items`,
      { title: "Blocked Content", type: "VIDEO" },
    );
    expect(inaccessibleCreate.status).toBe(404);

    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id, editor.auth.user.id] },
    );

    const producerContent = await createContentRecord(
      producer.client,
      alpha.organization.id,
      project.id,
      { title: "Producer Created", type: "VIDEO" },
    );
    expect(producerContent.status).toBe("BRIEF");

    const editorCreate = await editor.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/content-items`,
      { title: "Editor Content", type: "VIDEO" },
    );
    expect(editorCreate.status).toBe(403);

    const producerList = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items`,
    );
    expect(producerList.status).toBe(200);
    expect(producerList.body.content).toHaveLength(2);

    const updated = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      {
        title: "Episode 01 — The Long Game (Final)",
        type: "VIDEO",
        deadline: null,
        assigneeId: producer.auth.user.id,
      },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.content.title).toBe("Episode 01 — The Long Game (Final)");
    expect(updated.body.content.type).toBe("VIDEO");
    expect(updated.body.content.deadline).toBeNull();
    expect(updated.body.content.assignee.id).toBe(producer.auth.user.id);

    const editorPatch = await editor.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      { title: "Editor Rename" },
    );
    expect(editorPatch.status).toBe(403);

    const search = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items?search=Producer`,
    );
    expect(search.body.content).toHaveLength(1);

    const mine = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items?assigneeId=me`,
    );
    expect(mine.body.content).toHaveLength(1);

    const crossTenant = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/content-items/${content.id}`,
    );
    expect(crossTenant.status).toBe(404);

    const crossTenantCreate = await beta.client.post(
      `/api/v1/organizations/${beta.organization.id}/projects/${project.id}/content-items`,
      { title: "Cross Tenant", type: "VIDEO" },
    );
    expect(crossTenantCreate.status).toBe(404);
  });

  it("enforces valid transitions, records history, and rejects conflicting moves", async () => {
    const { alpha, project } = await setupProject();
    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Workflow Episode",
    });

    const invalid = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "CLIENT_APPROVAL",
    );
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("INVALID_CONTENT_TRANSITION");

    const bypass = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      { status: "READY_TO_PUBLISH" },
    );
    expect(bypass.status).toBe(400);
    expect(bypass.body.error.code).toBe("VALIDATION_ERROR");

    let expectedVersion = 1;
    for (const status of ["SCRIPT", "SHOOT", "EDITING", "INTERNAL_REVIEW"] as const) {
      const response = await transitionContentRecord(
        alpha.client,
        alpha.organization.id,
        content.id,
        status,
      );
      expect(response.status).toBe(200);
      expectedVersion += 1;
      expect(response.body.content.status).toBe(status);
      expect(response.body.content.version).toBe(expectedVersion);
      expect(response.body.event.fromStatus).not.toBe(status);
      expect(response.body.event.actor.email).toBe("alpha@example.com");
    }

    const skipReview = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "READY_TO_PUBLISH",
    );
    expect(skipReview.status).toBe(409);

    const toApproval = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "CLIENT_APPROVAL",
    );
    expect(toApproval.status).toBe(200);

    const revisionWithoutNote = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "EDITING",
    );
    expect(revisionWithoutNote.status).toBe(400);
    expect(revisionWithoutNote.body.error.code).toBe("TRANSITION_NOTE_REQUIRED");

    const revision = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "EDITING",
      "Client wants a tighter opening.",
    );
    expect(revision.status).toBe(200);
    expect(revision.body.event.note).toBe("Client wants a tighter opening.");

    await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "INTERNAL_REVIEW",
    );
    await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "CLIENT_APPROVAL",
    );
    const approved = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "READY_TO_PUBLISH",
    );
    expect(approved.status).toBe(200);

    const terminal = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "EDITING",
      "Try to reopen",
    );
    expect(terminal.status).toBe(409);

    const history = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/events`,
    );
    expect(history.status).toBe(200);
    const events = history.body.events as WorkflowEventView[];
    expect(events).toHaveLength(9);
    expect(events[0]!.fromStatus).toBe("BRIEF");
    expect(events[0]!.toStatus).toBe("SCRIPT");
    expect(events.at(-1)!.toStatus).toBe("READY_TO_PUBLISH");
    expect(events.every((event) => event.actor?.email === "alpha@example.com")).toBe(true);
    expect(events.some((event) => event.note === "Client wants a tighter opening.")).toBe(true);

    const stored = await prisma.contentItem.findUnique({
      where: { id: content.id },
      select: { status: true, version: true },
    });
    expect(stored?.status).toBe("READY_TO_PUBLISH");
    expect(stored?.version).toBe(10);
  });

  it("allows exactly one of two concurrent transitions and writes one event", async () => {
    const { alpha, project } = await setupProject();
    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Concurrent Episode",
    });

    const [first, second] = await Promise.all([
      transitionContentRecord(alpha.client, alpha.organization.id, content.id, "SCRIPT"),
      transitionContentRecord(alpha.client, alpha.organization.id, content.id, "SCRIPT"),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.error.code).toBe("CONTENT_STATE_CHANGED");

    const events = await prisma.workflowEvent.findMany({
      where: { contentItemId: content.id },
    });
    expect(events).toHaveLength(1);

    const stale = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/transitions`,
      { toStatus: "SHOOT", expectedVersion: 1 },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CONTENT_STATE_CHANGED");

    const current = await prisma.contentItem.findUniqueOrThrow({
      where: { id: content.id },
      select: { version: true },
    });
    const fresh = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/transitions`,
      { toStatus: "SHOOT", expectedVersion: current.version },
    );
    expect(fresh.status).toBe(200);
    expect(fresh.body.content.status).toBe("SHOOT");
    expect(await prisma.workflowEvent.count({ where: { contentItemId: content.id } })).toBe(2);
  });

  it("applies the role transition policy for producers and editors", async () => {
    const { alpha, project } = await setupProject();
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

    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Role Policy Episode",
    });

    const producerAdvance = await transitionContentRecord(
      producer.client,
      alpha.organization.id,
      content.id,
      "SCRIPT",
    );
    expect(producerAdvance.status).toBe(200);

    const editorAdvance = await transitionContentRecord(
      editor.client,
      alpha.organization.id,
      content.id,
      "SHOOT",
    );
    expect(editorAdvance.status).toBe(403);
    expect(editorAdvance.body.error.code).toBe("CONTENT_TRANSITION_FORBIDDEN");

    await transitionContentRecord(alpha.client, alpha.organization.id, content.id, "SHOOT");
    await transitionContentRecord(alpha.client, alpha.organization.id, content.id, "EDITING");

    const editorSubmit = await transitionContentRecord(
      editor.client,
      alpha.organization.id,
      content.id,
      "INTERNAL_REVIEW",
    );
    expect(editorSubmit.status).toBe(200);

    const editorReopen = await transitionContentRecord(
      editor.client,
      alpha.organization.id,
      content.id,
      "EDITING",
    );
    expect(editorReopen.status).toBe(403);

    const producerToClient = await transitionContentRecord(
      producer.client,
      alpha.organization.id,
      content.id,
      "CLIENT_APPROVAL",
    );
    expect(producerToClient.status).toBe(403);

    await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "CLIENT_APPROVAL",
    );
    const producerApprove = await transitionContentRecord(
      producer.client,
      alpha.organization.id,
      content.id,
      "READY_TO_PUBLISH",
    );
    expect(producerApprove.status).toBe(403);

    const editorRead = await editor.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
    );
    expect(editorRead.status).toBe(200);
  });

  it("validates assignees and blocks mutations on completed projects", async () => {
    const { alpha, project } = await setupProject();
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    const outsider = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "outsider@alpha.test",
      "PRODUCER",
      "Off Project Producer",
    );

    const unassignedProject = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/content-items`,
      {
        title: "Bad Assignee",
        type: "VIDEO",
        assigneeId: outsider.auth.user.id,
      },
    );
    expect(unassignedProject.status).toBe(400);
    expect(unassignedProject.body.error.code).toBe("ASSIGNEE_NOT_ON_PROJECT");

    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );

    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Assigned Episode",
      assigneeId: producer.auth.user.id,
    });
    expect(content.assignee?.id).toBe(producer.auth.user.id);

    const clientRecord = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Portal Assignee Client",
    });
    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      clientRecord.id,
      "portal-assignee@example.test",
    );
    const contact = await createApiClient();
    const accepted = await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Portal Assignee",
      password: PASSWORD,
    });
    const contactUserId = accepted.body.user.id as string;

    const clientAssignee = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      { assigneeId: contactUserId },
    );
    expect(clientAssignee.status).toBe(400);
    expect(clientAssignee.body.error.code).toBe("INVALID_ASSIGNEE");

    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "COMPLETED" },
    );

    const createOnCompleted = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/content-items`,
      { title: "Late Content", type: "VIDEO" },
    );
    expect(createOnCompleted.status).toBe(409);
    expect(createOnCompleted.body.error.code).toBe("PROJECT_COMPLETED");

    const transitionOnCompleted = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "SCRIPT",
    );
    expect(transitionOnCompleted.status).toBe(409);

    const updateOnCompleted = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      { title: "Late Rename" },
    );
    expect(updateOnCompleted.status).toBe(409);
  });

  it("hides content and history from unauthorized projects and tenants", async () => {
    const { alpha, project } = await setupProject();
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Private Episode",
    });

    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );

    for (const client of [producer.client, beta.client]) {
      const organizationId =
        client === producer.client ? alpha.organization.id : beta.organization.id;
      const detail = await client.get(
        `/api/v1/organizations/${organizationId}/content-items/${content.id}`,
      );
      expect(detail.status).toBe(404);

      const events = await client.get(
        `/api/v1/organizations/${organizationId}/content-items/${content.id}/events`,
      );
      expect(events.status).toBe(404);

      const transition = await transitionContentRecord(
        client,
        organizationId,
        content.id,
        "SCRIPT",
      );
      expect(transition.status).toBe(404);
    }

    const producerList = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items`,
    );
    expect(producerList.body.content).toHaveLength(0);

    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    const producerDetail = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
    );
    expect(producerDetail.status).toBe(200);
  });
});
