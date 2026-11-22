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
  uploadAssetRecord,
} from "./helpers.js";

async function setupProject() {
  const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
  const client = await createClientRecord(alpha.client, alpha.organization.id, {
    name: "Asset Client",
  });
  const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
    name: "Asset Project",
  });
  const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
    title: "Asset Content",
  });
  return { alpha, client, project, content };
}

async function createIntent(
  organizationId: string,
  projectId: string,
  contentItemId: string | null,
  createdById: string,
  sizeBytes: number,
) {
  return prisma.assetUpload.create({
    data: {
      organizationId,
      projectId,
      contentItemId,
      createdById,
      originalFilename: "existing.txt",
      mimeType: "text/plain",
      sizeBytes,
      storageKey: `${organizationId}/${projectId}/existing-${Date.now()}.txt`,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
}

describe("asset uploads and downloads", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("uploads directly to storage, verifies metadata, and downloads", async () => {
    const { alpha, project, content } = await setupProject();
    const body = Buffer.from("Direct-to-storage deliverable");

    const intentResponse = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        contentItemId: content.id,
        originalFilename: "final-cut.txt",
        mimeType: "text/plain",
        sizeBytes: body.length,
      },
    );
    expect(intentResponse.status).toBe(201);
    expect(intentResponse.body.intent.upload.method).toBe("PUT");
    expect(intentResponse.body.intent.upload.url).toContain("X-Amz-Signature");

    const upload = await fetch(intentResponse.body.intent.upload.url as string, {
      method: "PUT",
      headers: intentResponse.body.intent.upload.headers as Record<string, string>,
      body: new Uint8Array(body),
    });
    expect(upload.ok).toBe(true);

    const completed = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: intentResponse.body.intent.uploadId },
    );
    expect(completed.status).toBe(201);
    const asset = completed.body.asset;
    expect(asset.originalFilename).toBe("final-cut.txt");
    expect(asset.mimeType).toBe("text/plain");
    expect(asset.sizeBytes).toBe(body.length);
    expect(asset.contentItem.id).toBe(content.id);
    expect(asset.uploadedBy.email).toBe("alpha@example.com");

    const list = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/assets`,
    );
    expect(list.status).toBe(200);
    expect(list.body.assets).toHaveLength(1);

    const allAssets = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/assets?projectId=${project.id}`,
    );
    expect(allAssets.body.assets).toHaveLength(1);

    const download = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/${asset.id}/download-url`,
      { disposition: "attachment" },
    );
    expect(download.status).toBe(200);
    expect(download.body.url).toContain("X-Amz-Signature");
    const downloaded = await fetch(download.body.url as string);
    expect(downloaded.status).toBe(200);
    expect(Buffer.from(await downloaded.arrayBuffer()).toString()).toBe(body.toString());

    const detail = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/assets/${asset.id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.asset.id).toBe(asset.id);
  });

  it("rejects uploads that violate size, MIME, project, and ownership rules", async () => {
    const { alpha, project, content } = await setupProject();
    const beta = await setupOrganization("Beta Studio", "beta@example.com");

    const badMime = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        originalFilename: "script.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 10,
      },
    );
    expect(badMime.status).toBe(400);
    expect(badMime.body.error.code).toBe("VALIDATION_ERROR");

    const tooLarge = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        originalFilename: "huge.mp4",
        mimeType: "video/mp4",
        sizeBytes: 262_144_001,
      },
    );
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.error.code).toBe("ASSET_TOO_LARGE");

    const otherClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Other Client",
    });
    const otherProject = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      otherClient.id,
      { name: "Other Project" },
    );
    const otherContent = await createContentRecord(
      alpha.client,
      alpha.organization.id,
      otherProject.id,
      { title: "Other Content" },
    );

    const wrongContent = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        contentItemId: otherContent.id,
        originalFilename: "wrong.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      },
    );
    expect(wrongContent.status).toBe(400);
    expect(wrongContent.body.error.code).toBe("INVALID_ASSET_CONTENT");

    const crossTenant = await beta.client.post(
      `/api/v1/organizations/${beta.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        originalFilename: "blocked.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      },
    );
    expect(crossTenant.status).toBe(404);

    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    const noProject = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        originalFilename: "blocked.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      },
    );
    expect(noProject.status).toBe(404);

    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
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
      { userIds: [editor.auth.user.id] },
    );

    const producerIntent = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        contentItemId: content.id,
        originalFilename: "producer.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      },
    );
    expect(producerIntent.status).toBe(201);

    const editorComplete = await editor.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: producerIntent.body.intent.uploadId },
    );
    expect(editorComplete.status).toBe(404);

    const asset = await uploadAssetRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      contentItemId: content.id,
      originalFilename: "private.txt",
      body: Buffer.from("private"),
    });

    const producerDetail = await producer.client.get(
      `/api/v1/organizations/${alpha.organization.id}/assets/${asset.id}`,
    );
    expect(producerDetail.status).toBe(200);

    const betaDetail = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/assets/${asset.id}`,
    );
    expect(betaDetail.status).toBe(404);
  });

  it("rejects expired intents, duplicate completion, and metadata mismatches", async () => {
    const { alpha, project, content } = await setupProject();

    const sizeIntent = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        contentItemId: content.id,
        originalFilename: "size.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
      },
    );
    const smallBody = Buffer.from("short");
    await fetch(sizeIntent.body.intent.upload.url as string, {
      method: "PUT",
      headers: sizeIntent.body.intent.upload.headers as Record<string, string>,
      body: new Uint8Array(smallBody),
    });
    const mismatch = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: sizeIntent.body.intent.uploadId },
    );
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe("UPLOAD_SIZE_MISMATCH");

    const mimeIntent = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        originalFilename: "mime.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
      },
    );
    await fetch(mimeIntent.body.intent.upload.url as string, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array(Buffer.from("mime")),
    });
    const mimeMismatch = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: mimeIntent.body.intent.uploadId },
    );
    expect(mimeMismatch.status).toBeLessThan(500);
    expect(mimeMismatch.status).toBeGreaterThanOrEqual(400);

    const duplicate = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: sizeIntent.body.intent.uploadId },
    );
    expect(duplicate.status).toBe(400);

    const expiredIntent = await createIntent(
      alpha.organization.id,
      project.id,
      content.id,
      alpha.auth.user.id,
      5,
    );
    await prisma.assetUpload.update({
      where: { id: expiredIntent.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: expiredIntent.id },
    );
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe("UPLOAD_INTENT_EXPIRED");

    const validIntent = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        originalFilename: "duplicate.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
      },
    );
    await fetch(validIntent.body.intent.upload.url as string, {
      method: "PUT",
      headers: validIntent.body.intent.upload.headers as Record<string, string>,
      body: new Uint8Array(Buffer.from("done")),
    });
    const firstComplete = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: validIntent.body.intent.uploadId },
    );
    expect(firstComplete.status).toBe(201);
    const duplicateComplete = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/complete`,
      { uploadId: validIntent.body.intent.uploadId },
    );
    expect(duplicateComplete.status).toBe(409);
    expect(duplicateComplete.body.error.code).toBe("UPLOAD_ALREADY_COMPLETED");
  });

  it("blocks uploads for completed projects and client users", async () => {
    const { alpha, client, project, content } = await setupProject();

    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "portal-upload@example.test",
    );
    const contact = await createApiClient();
    await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Portal Upload",
      password: PASSWORD,
    });
    const clientUpload = await contact.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        contentItemId: content.id,
        originalFilename: "client.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
      },
    );
    expect(clientUpload.status).toBe(404);

    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}`,
      { status: "COMPLETED" },
    );
    const upload = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/assets/upload-intents`,
      {
        projectId: project.id,
        contentItemId: content.id,
        originalFilename: "late.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
      },
    );
    expect(upload.status).toBe(409);
    expect(upload.body.error.code).toBe("PROJECT_COMPLETED");
  });
});
