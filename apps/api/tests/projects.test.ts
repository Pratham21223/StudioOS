import { beforeEach, describe, expect, it } from "vitest";
import {
  addInternalMember,
  createApiClient,
  createClientRecord,
  createProjectRecord,
  inviteClientContact,
  PASSWORD,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

describe("project management and project access", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates projects for clients in the same organization and validates dates", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const alphaClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Alpha Client",
    });
    const betaClient = await createClientRecord(beta.client, beta.organization.id, {
      name: "Beta Client",
    });

    const project = await createProjectRecord(alpha.client, alpha.organization.id, alphaClient.id, {
      name: "Launch Campaign",
      description: "A launch film and cutdowns.",
      startDate: "2026-12-01",
      deadline: "2026-12-20",
    });

    expect(project.name).toBe("Launch Campaign");
    expect(project.status).toBe("ACTIVE");
    expect(project.startDate).toBe("2026-12-01");
    expect(project.deadline).toBe("2026-12-20");
    expect(project.client.id).toBe(alphaClient.id);
    expect(project.memberCount).toBe(0);

    const list = await alpha.client.get(`/api/v1/organizations/${alpha.organization.id}/projects`);
    expect(list.status).toBe(200);
    expect(list.body.projects).toHaveLength(1);

    const crossClient = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects`,
      {
        clientId: betaClient.id,
        name: "Cross Tenant Project",
      },
    );
    expect(crossClient.status).toBe(404);
    expect(crossClient.body.error.code).toBe("CLIENT_NOT_FOUND");

    const invalidDates = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects`,
      {
        clientId: alphaClient.id,
        name: "Bad Dates",
        startDate: "2026-12-20",
        deadline: "2026-12-01",
      },
    );
    expect(invalidDates.status).toBe(400);
    expect(invalidDates.body.error.code).toBe("INVALID_PROJECT_DATES");

    const malformedDate = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects`,
      {
        clientId: alphaClient.id,
        name: "Malformed Date",
        deadline: "12/20/2026",
      },
    );
    expect(malformedDate.status).toBe(400);
    expect(malformedDate.body.error.code).toBe("VALIDATION_ERROR");

    const archivedClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Archived Client",
    });
    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${archivedClient.id}`,
      { status: "ARCHIVED" },
    );
    const archivedProject = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects`,
      { clientId: archivedClient.id, name: "Blocked Project" },
    );
    expect(archivedProject.status).toBe(400);
    expect(archivedProject.body.error.code).toBe("CLIENT_ARCHIVED");

    const crossTenantRead = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/projects/${project.id}`,
    );
    expect(crossTenantRead.status).toBe(404);

    const crossTenantUpdate = await beta.client.patch(
      `/api/v1/organizations/${beta.organization.id}/projects/${project.id}`,
      { name: "Hijacked Project" },
    );
    expect(crossTenantUpdate.status).toBe(404);
  });

  it("scopes producer and editor project visibility to project membership", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Scoped Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Scoped Project",
    });
    const pm = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "pm@alpha.test",
      "PROJECT_MANAGER",
      "Priya Manager",
    );
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

    const pmList = await pm.client.get(`/api/v1/organizations/${alpha.organization.id}/projects`);
    expect(pmList.body.projects).toHaveLength(1);

    for (const member of [producer, editor]) {
      const list = await member.client.get(
        `/api/v1/organizations/${alpha.organization.id}/projects`,
      );
      expect(list.status).toBe(200);
      expect(list.body.projects).toHaveLength(0);

      const detail = await member.client.get(
        `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      );
      expect(detail.status).toBe(404);
    }

    const assignProducer = await pm.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    expect(assignProducer.status).toBe(200);
    expect(assignProducer.body.members).toHaveLength(1);
    expect(assignProducer.body.members[0].user.email).toBe("producer@alpha.test");

    const producerList = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/projects`,
    );
    expect(producerList.body.projects).toHaveLength(1);

    const producerDetail = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
    );
    expect(producerDetail.status).toBe(200);

    const producerMembers = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
    );
    expect(producerMembers.status).toBe(200);

    const producerAssign = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [editor.auth.user.id] },
    );
    expect(producerAssign.status).toBe(403);

    const editorAssign = await editor.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [editor.auth.user.id] },
    );
    expect(editorAssign.status).toBe(403);

    const duplicateAdd = await pm.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    expect(duplicateAdd.status).toBe(200);
    expect(duplicateAdd.body.members).toHaveLength(1);

    const removeProducer = await pm.client.agent
      .delete(
        `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members/${producer.auth.user.id}`,
      )
      .set("x-csrf-token", pm.client.csrfToken);
    expect(removeProducer.status).toBe(200);
    expect(removeProducer.body.removed).toBe(true);

    expect(
      (await producer.client.get(`/api/v1/organizations/${alpha.organization.id}/projects`)).body
        .projects,
    ).toHaveLength(0);
    expect(
      (
        await producer.client.get(
          `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
        )
      ).status,
    ).toBe(404);
  });

  it("rejects inactive, client, and cross-tenant project members", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Member Scope Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Member Scope Project",
    });

    const clientInvite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "portal-contact@example.test",
    );
    const contact = await createApiClient();
    const accepted = await contact.post("/api/v1/invitations/accept", {
      token: clientInvite.token,
      name: "Portal Contact",
      password: PASSWORD,
    });
    const contactUserId = accepted.body.user.id as string;

    const clientMemberAttempt = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [contactUserId] },
    );
    expect(clientMemberAttempt.status).toBe(400);
    expect(clientMemberAttempt.body.error.code).toBe("INVALID_PROJECT_MEMBER");

    const crossTenantAttempt = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [beta.auth.user.id] },
    );
    expect(crossTenantAttempt.status).toBe(400);

    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "inactive@alpha.test",
      "PRODUCER",
      "Inactive Producer",
    );
    const deactivate = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${producer.membership.id}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivate.status).toBe(200);

    const inactiveAttempt = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    expect(inactiveAttempt.status).toBe(400);
    expect(inactiveAttempt.body.error.code).toBe("INVALID_PROJECT_MEMBER");
  });

  it("updates projects, pauses and completes them, and enforces terminal status", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Status Client",
    });
    const secondClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Second Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Status Project",
      startDate: "2026-12-01",
      deadline: "2026-12-20",
    });

    const paused = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "PAUSED", name: "Status Project Paused" },
    );
    expect(paused.status).toBe(200);
    expect(paused.body.project.status).toBe("PAUSED");

    const resumed = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "ACTIVE", clientId: secondClient.id },
    );
    expect(resumed.status).toBe(200);
    expect(resumed.body.project.client.id).toBe(secondClient.id);

    const invalidDeadline = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { deadline: "2026-11-01" },
    );
    expect(invalidDeadline.status).toBe(400);
    expect(invalidDeadline.body.error.code).toBe("INVALID_PROJECT_DATES");

    const clearedDates = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { startDate: null, deadline: null },
    );
    expect(clearedDates.status).toBe(200);
    expect(clearedDates.body.project.startDate).toBeNull();

    const completed = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "COMPLETED" },
    );
    expect(completed.status).toBe(200);
    expect(completed.body.project.status).toBe("COMPLETED");

    const reopen = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "PAUSED" },
    );
    expect(reopen.status).toBe(409);
    expect(reopen.body.error.code).toBe("PROJECT_COMPLETED");

    const metadataAfterCompletion = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { description: "Delivery archived." },
    );
    expect(metadataAfterCompletion.status).toBe(200);

    const archivedClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Archived Target",
    });
    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${archivedClient.id}`,
      { status: "ARCHIVED" },
    );
    const moveToArchived = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { clientId: archivedClient.id },
    );
    expect(moveToArchived.status).toBe(400);
    expect(moveToArchived.body.error.code).toBe("CLIENT_ARCHIVED");

    const filtered = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/projects?status=COMPLETED&clientId=${secondClient.id}`,
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.projects).toHaveLength(1);
  });

  it("restricts project creation and updates to managers", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Roles Client",
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
    const pm = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "pm@alpha.test",
      "PROJECT_MANAGER",
      "Priya Manager",
    );

    const pmProject = await createProjectRecord(pm.client, alpha.organization.id, client.id, {
      name: "PM Created Project",
    });
    expect(pmProject.name).toBe("PM Created Project");

    for (const member of [producer, editor]) {
      const create = await member.client.post(
        `/api/v1/organizations/${alpha.organization.id}/projects`,
        { clientId: client.id, name: "Forbidden Project" },
      );
      expect(create.status).toBe(403);
    }

    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Managed Project",
    });

    for (const member of [producer, editor]) {
      const update = await member.client.patch(
        `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
        { name: "Forbidden Rename" },
      );
      expect(update.status).toBe(403);
    }
  });
});
