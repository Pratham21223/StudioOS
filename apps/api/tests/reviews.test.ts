import { beforeEach, describe, expect, it } from "vitest";
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
  uploadAssetRecord,
} from "./helpers.js";

async function setupReviewProject() {
  const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
  const client = await createClientRecord(alpha.client, alpha.organization.id, {
    name: "Review Client",
  });
  const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
    name: "Review Project",
  });
  const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
    title: "Review Content",
  });
  return { alpha, client, project, content };
}

describe("internal reviews and feedback records", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("records feedback against the current content version and asset", async () => {
    const { alpha, project, content } = await setupReviewProject();
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
      originalFilename: "review-cut.txt",
      body: Buffer.from("review cut"),
    });

    const feedback = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      {
        feedback: "Tighten the opening and fix the lower-third timing.",
        assetId: asset.id,
      },
    );
    expect(feedback.status).toBe(201);
    expect(feedback.body.review.decision).toBe("INTERNAL_FEEDBACK");
    expect(feedback.body.review.contentVersion).toBe(1);
    expect(feedback.body.review.feedback).toContain("Tighten the opening");
    expect(feedback.body.review.asset.id).toBe(asset.id);
    expect(feedback.body.review.reviewer.email).toBe("producer@alpha.test");

    const list = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
    );
    expect(list.status).toBe(200);
    expect(list.body.reviews).toHaveLength(1);

    const orgList = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/reviews?decision=INTERNAL_FEEDBACK`,
    );
    expect(orgList.status).toBe(200);
    expect(orgList.body.reviews).toHaveLength(1);
    expect(orgList.body.reviews[0].content.id).toBe(content.id);

    const emptyFeedback = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "   " },
    );
    expect(emptyFeedback.status).toBe(400);

    const otherContent = await createContentRecord(
      alpha.client,
      alpha.organization.id,
      project.id,
      { title: "Other Review Content" },
    );
    const wrongAsset = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${otherContent.id}/reviews`,
      { feedback: "Wrong asset", assetId: asset.id },
    );
    expect(wrongAsset.status).toBe(400);
    expect(wrongAsset.body.error.code).toBe("INVALID_REVIEW_ASSET");
  });

  it("scopes review access to project members and tenants", async () => {
    const { alpha, client, project, content } = await setupReviewProject();
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );

    const noAccess = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
    );
    expect(noAccess.status).toBe(404);

    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    const feedback = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "Project feedback" },
    );
    expect(feedback.status).toBe(201);

    const crossTenant = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/content-items/${content.id}/reviews`,
    );
    expect(crossTenant.status).toBe(404);

    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "review-client@example.test",
    );
    const contact = await createApiClient();
    await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Review Client User",
      password: PASSWORD,
    });
    const clientAccess = await contact.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
    );
    expect(clientAccess.status).toBe(404);

    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "COMPLETED" },
    );
    const completedFeedback = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "Late feedback" },
    );
    expect(completedFeedback.status).toBe(409);
    expect(completedFeedback.body.error.code).toBe("PROJECT_COMPLETED");
  });
});
