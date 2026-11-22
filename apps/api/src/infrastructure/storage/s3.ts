import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";

type StorageConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

function storageConfig(): StorageConfig | null {
  if (!env.S3_REGION || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return null;
  }
  return {
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
  };
}

let cachedClient: S3Client | null = null;
let bucketChecked = false;

function storageClient(): S3Client {
  const config = storageConfig();
  if (!config) {
    throw new AppError(
      503,
      "STORAGE_UNAVAILABLE",
      "Object storage is not configured. Uploads and downloads are unavailable.",
    );
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    });
  }
  return cachedClient;
}

function bucket(): string {
  const config = storageConfig();
  if (!config) storageClient();
  return config!.bucket;
}

async function ensureBucket(): Promise<void> {
  if (bucketChecked) return;
  const client = storageClient();
  const Bucket = bucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket }));
    bucketChecked = true;
    return;
  } catch {
    if (!env.S3_AUTO_CREATE_BUCKET) {
      throw new AppError(
        503,
        "STORAGE_BUCKET_UNAVAILABLE",
        "The configured storage bucket is not available.",
      );
    }
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket }));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
      throw error;
    }
  }
  bucketChecked = true;
}

export type UploadTarget = {
  url: string;
  method: "PUT";
  storageKey: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export const storage = {
  isConfigured(): boolean {
    return storageConfig() !== null;
  },

  async createUploadTarget(input: {
    storageKey: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget> {
    await ensureBucket();
    const command = new PutObjectCommand({
      Bucket: bucket(),
      Key: input.storageKey,
      ContentType: input.contentType,
    });
    const url = await getSignedUrl(storageClient(), command, {
      expiresIn: input.expiresInSeconds,
    });
    return {
      url,
      method: "PUT",
      storageKey: input.storageKey,
      headers: { "Content-Type": input.contentType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
    };
  },

  async headObject(storageKey: string) {
    await ensureBucket();
    try {
      const result = await storageClient().send(
        new HeadObjectCommand({ Bucket: bucket(), Key: storageKey }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
        etag: result.ETag ?? null,
      };
    } catch {
      return null;
    }
  },

  async createDownloadTarget(input: {
    storageKey: string;
    filename: string;
    mimeType: string;
    disposition: "attachment" | "inline";
    expiresInSeconds: number;
  }): Promise<string> {
    const safeFilename = input.filename.replace(/["\\\r\n]/g, "_");
    const encoded = encodeURIComponent(input.filename);
    const command = new GetObjectCommand({
      Bucket: bucket(),
      Key: input.storageKey,
      ResponseContentType: input.mimeType,
      ResponseContentDisposition: `${input.disposition}; filename="${safeFilename}"; filename*=UTF-8''${encoded}`,
    });
    return getSignedUrl(storageClient(), command, {
      expiresIn: input.expiresInSeconds,
    });
  },
};
