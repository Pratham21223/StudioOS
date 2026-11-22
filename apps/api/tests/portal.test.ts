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
  uploadAssetRecord,
  type ContentView,
} from "./helpers.js";

async function submitForClient(
  alpha: Awaited<ReturnType<typeof setupOrganization>>,
  content: ContentView,
) {
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
      content.id,
      status,
    );
    expect(response.status).toBe(200);
  }
  const current = await alpha.client.get(
    `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
  );
  return current.body.content as ContentView;
}

async function setupPortal() {
  const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
  const client = await createClientRecord(alpha.client, alpha.organization.id, {
    name: "Portal Client",
  });
  const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
    name: "Portal Project",
  });
  const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
    title: "Portal Deliverable",
  });
  return { alpha, client, project, content };
}

async function invitePortalUser(
  alpha: Awaited<ReturnType<typeof setupOrganization>>,
  clientId: string,
  email: string,
  name = "Portal Reviewer",
) {
  const invite = await inviteClientContact(alpha.client, alpha.organization.id, clientId, email);
  const contact = await createApiClient();
  const accepted = await contact.post("/api/v1/invitations/accept", {
    token: invite.token,
    name,
    password: PASSWORD,
  });
  expect(accepted.status).toBe(200);
  return contact;
}

describe("client portal review and approval", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("shows only submitted deliverables and approves the submitted version", async () => {
    const { alpha, client, project, content } = await setupPortal();
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
    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      { assigneeId: producer.auth.user.id },
    );
    const asset = await uploadAssetRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      contentItemId: content.id,
      originalFilename: "portal-cut.txt",
      body: Buffer.from("client deliverable"),
    });
    const feedback = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "Internal notes that clients must never see." },
    );
    expect(feedback.status).toBe(201);

    const submitted = await submitForClient(alpha, content);
    expect(submitted.status).toBe("CLIENT_APPROVAL");
    expect(submitted.version).toBe(6);

    const contact = await invitePortalUser(alpha, client.id, "portal-review@example.test");

    const projects = await contact.get("/api/v1/client-portal/projects");
    expect(projects.status).toBe(200);
    expect(projects.body.projects).toHaveLength(1);
    expect(projects.body.projects[0].id).toBe(project.id);
    expect(projects.body.projects[0].awaitingReviewCount).toBe(1);

    const projectContent = await contact.get(
      `/api/v1/client-portal/projects/${project.id}/content-items`,
    );
    expect(projectContent.status).toBe(200);
    expect(projectContent.body.content).toHaveLength(1);
    expect(projectContent.body.content[0].id).toBe(content.id);
    expect(projectContent.body.content[0].assets).toHaveLength(1);
    expect(projectContent.body.content[0].reviews).toHaveLength(0);
    expect(JSON.stringify(projectContent.body)).not.toContain("Internal notes");

    const detail = await contact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.content.version).toBe(6);
    expect(detail.body.content.project.client.id).toBe(client.id);

    const download = await contact.post(`/api/v1/client-portal/assets/${asset.id}/download-url`, {
      disposition: "inline",
    });
    expect(download.status).toBe(200);
    const downloaded = await fetch(download.body.url as string);
    expect(Buffer.from(await downloaded.arrayBuffer()).toString()).toBe("client deliverable");

    const stale = await contact.post(`/api/v1/client-portal/content-items/${content.id}/approve`, {
      expectedVersion: 5,
      assetId: asset.id,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CONTENT_STATE_CHANGED");

    const approved = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/approve`,
      {
        expectedVersion: 6,
        assetId: asset.id,
        feedback: "Approved for launch.",
      },
    );
    expect(approved.status).toBe(200);
    expect(approved.body.content.status).toBe("READY_TO_PUBLISH");
    expect(approved.body.content.version).toBe(7);
    expect(approved.body.review.decision).toBe("CLIENT_APPROVED");
    expect(approved.body.review.contentVersion).toBe(6);
    expect(approved.body.review.asset.id).toBe(asset.id);

    const stored = await prisma.contentItem.findUniqueOrThrow({
      where: { id: content.id },
      select: { status: true, version: true },
    });
    expect(stored.status).toBe("READY_TO_PUBLISH");
    expect(stored.version).toBe(7);
    const review = await prisma.review.findFirstOrThrow({
      where: { contentItemId: content.id, decision: "CLIENT_APPROVED" },
    });
    expect(review.contentVersion).toBe(6);
    const event = await prisma.workflowEvent.findFirstOrThrow({
      where: { contentItemId: content.id, toStatus: "READY_TO_PUBLISH" },
    });
    const portalUser = await prisma.user.findUniqueOrThrow({
      where: { email: "portal-review@example.test" },
      select: { id: true },
    });
    expect(event.actorId).toBe(portalUser.id);
    expect(event.fromStatus).toBe("CLIENT_APPROVAL");

    const after = await contact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(after.status).toBe(200);
    expect(after.body.content.status).toBe("READY_TO_PUBLISH");
    expect(after.body.content.reviews).toHaveLength(1);

    const repeat = await contact.post(`/api/v1/client-portal/content-items/${content.id}/approve`, {
      expectedVersion: 7,
    });
    expect(repeat.status).toBe(409);
    expect(repeat.body.error.code).toBe("CONTENT_NOT_AWAITING_APPROVAL");

    const internal = await contact.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
    );
    expect(internal.status).toBe(404);
  });

  it("requests revisions, hides the item, and records the next approval cycle", async () => {
    const { alpha, client, content } = await setupPortal();
    const submitted = await submitForClient(alpha, content);
    const contact = await invitePortalUser(
      alpha,
      client.id,
      "revision-client@example.test",
      "Revision Client",
    );

    const missingFeedback = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/request-revision`,
      { expectedVersion: submitted.version, feedback: "  " },
    );
    expect(missingFeedback.status).toBe(400);

    const revision = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/request-revision`,
      {
        expectedVersion: submitted.version,
        feedback: "Please replace the opening slate and tighten the ending.",
      },
    );
    expect(revision.status).toBe(200);
    expect(revision.body.content.status).toBe("EDITING");
    expect(revision.body.review.decision).toBe("CLIENT_REVISION_REQUESTED");
    expect(revision.body.review.contentVersion).toBe(submitted.version);
    expect(revision.body.review.feedback).toContain("replace the opening slate");

    const hidden = await contact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(hidden.status).toBe(404);
    const projectList = await contact.get(
      `/api/v1/client-portal/projects/${content.project.id}/content-items`,
    );
    expect(projectList.body.content).toHaveLength(0);

    for (const status of ["INTERNAL_REVIEW", "CLIENT_APPROVAL"] as const) {
      const response = await transitionContentRecord(
        alpha.client,
        alpha.organization.id,
        content.id,
        status,
      );
      expect(response.status).toBe(200);
    }

    const visibleAgain = await contact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(visibleAgain.status).toBe(200);
    expect(visibleAgain.body.content.reviews).toHaveLength(1);
    expect(visibleAgain.body.content.reviews[0].decision).toBe("CLIENT_REVISION_REQUESTED");

    const approved = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/approve`,
      { expectedVersion: visibleAgain.body.content.version },
    );
    expect(approved.status).toBe(200);
    expect(approved.body.content.status).toBe("READY_TO_PUBLISH");

    const reviews = await prisma.review.findMany({
      where: { contentItemId: content.id },
      orderBy: { createdAt: "asc" },
      select: { decision: true, contentVersion: true },
    });
    expect(reviews).toEqual([
      { decision: "CLIENT_REVISION_REQUESTED", contentVersion: submitted.version },
      { decision: "CLIENT_APPROVED", contentVersion: visibleAgain.body.content.version },
    ]);
  });

  it("isolates client portal data between client accounts", async () => {
    const { alpha, project, content } = await setupPortal();
    const submitted = await submitForClient(alpha, content);

    const otherClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Other Portal Client",
    });
    const otherProject = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      otherClient.id,
      { name: "Other Portal Project" },
    );

    const contact = await invitePortalUser(
      alpha,
      otherClient.id,
      "other-client@example.test",
      "Other Client",
    );

    const projects = await contact.get("/api/v1/client-portal/projects");
    expect(projects.body.projects).toHaveLength(1);
    expect(projects.body.projects[0].id).toBe(otherProject.id);

    const crossClient = await contact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(crossClient.status).toBe(404);
    const crossProject = await contact.get(
      `/api/v1/client-portal/projects/${project.id}/content-items`,
    );
    expect(crossProject.status).toBe(404);
    const crossApprove = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/approve`,
      { expectedVersion: submitted.version },
    );
    expect(crossApprove.status).toBe(404);

    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const betaInvite = await inviteClientContact(
      beta.client,
      beta.organization.id,
      (
        await createClientRecord(beta.client, beta.organization.id, {
          name: "Beta Portal Client",
        })
      ).id,
      "beta-client@example.test",
    );
    const betaContact = await createApiClient();
    await betaContact.post("/api/v1/invitations/accept", {
      token: betaInvite.token,
      name: "Beta Client",
      password: PASSWORD,
    });
    const betaCross = await betaContact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(betaCross.status).toBe(404);
  });
});
