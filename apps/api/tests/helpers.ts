import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";

export const app = createApp();

export const PASSWORD = "Test-password-2026!";
export const NEW_PASSWORD = "New-test-password-2026!";

export type MembershipView = {
  id: string;
  role: "ADMIN" | "PROJECT_MANAGER" | "PRODUCER" | "EDITOR";
  status: "ACTIVE" | "DEACTIVATED";
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

export type AuthView = {
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  memberships: MembershipView[];
  csrfToken: string;
};

type Agent = ReturnType<typeof request.agent>;

export class ApiClient {
  readonly agent: Agent;
  csrfToken = "";

  constructor() {
    this.agent = request.agent(app);
  }

  async init(): Promise<this> {
    const response = await this.agent.get("/api/v1/auth/csrf").expect(200);
    this.csrfToken = response.body.csrfToken as string;
    return this;
  }

  get(path: string) {
    return this.agent.get(path);
  }

  async post(path: string, body?: string | object) {
    const response = await this.agent.post(path).set("x-csrf-token", this.csrfToken).send(body);
    this.captureCsrf(response.body);
    return response;
  }

  async patch(path: string, body?: string | object) {
    const response = await this.agent.patch(path).set("x-csrf-token", this.csrfToken).send(body);
    this.captureCsrf(response.body);
    return response;
  }

  private captureCsrf(body: unknown): void {
    if (
      typeof body === "object" &&
      body !== null &&
      "csrfToken" in body &&
      typeof body.csrfToken === "string"
    ) {
      this.csrfToken = body.csrfToken;
    }
  }
}

export async function createApiClient(): Promise<ApiClient> {
  return new ApiClient().init();
}

export type RegisterOptions = {
  name?: string;
  email: string;
  password?: string;
  organizationName: string;
};

export async function registerUser(
  client: ApiClient,
  options: RegisterOptions,
): Promise<{ response: request.Response; body: AuthView }> {
  const response = await client.post("/api/v1/auth/register", {
    name: options.name ?? "Test User",
    email: options.email,
    password: options.password ?? PASSWORD,
    organizationName: options.organizationName,
  });
  return { response, body: response.body as AuthView };
}

export type OrganizationSetup = {
  client: ApiClient;
  auth: AuthView;
  organization: MembershipView["organization"];
  membership: MembershipView;
};

export async function setupOrganization(
  organizationName: string,
  email: string,
  name = "Test Admin",
): Promise<OrganizationSetup> {
  const client = await createApiClient();
  const { response, body } = await registerUser(client, {
    name,
    email,
    organizationName,
  });

  if (response.status !== 201) {
    throw new Error(`Failed to set up organization: ${JSON.stringify(response.body)}`);
  }

  return {
    client,
    auth: body,
    organization: body.memberships[0]!.organization,
    membership: body.memberships[0]!,
  };
}

export function extractInvitationToken(inviteUrl: string): string {
  const url = new URL(inviteUrl);
  const token = url.pathname.split("/").filter(Boolean).pop();
  if (!token) throw new Error(`No token in invite URL: ${inviteUrl}`);
  return decodeURIComponent(token);
}

export type InvitationView = {
  id: string;
  email: string;
  role: MembershipView["role"];
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export async function inviteMember(
  client: ApiClient,
  organizationId: string,
  email: string,
  role: MembershipView["role"],
): Promise<{ response: request.Response; invitation: InvitationView; token: string }> {
  const response = await client.post(`/api/v1/organizations/${organizationId}/invitations`, {
    email,
    role,
  });
  const invitation = response.body.invitation as InvitationView | undefined;
  const inviteUrl = response.body.inviteUrl as string | undefined;

  return {
    response,
    invitation: invitation as InvitationView,
    token: inviteUrl ? extractInvitationToken(inviteUrl) : "",
  };
}

export function extractResetToken(resetUrl: string): string {
  const token = new URL(resetUrl).searchParams.get("token");
  if (!token) throw new Error(`No token in reset URL: ${resetUrl}`);
  return token;
}

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_logs", "password_reset_tokens", "invitations", "sessions", "organization_memberships", "organizations", "users" RESTART IDENTITY CASCADE',
  );
}
