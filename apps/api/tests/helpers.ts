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

export type ClientMembershipView = {
  id: string;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  client: {
    id: string;
    name: string;
    status: "ACTIVE" | "ARCHIVED";
  };
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
  clientMemberships: ClientMembershipView[];
  csrfToken: string;
};

export type ClientView = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  brandGuidelines: string | null;
  status: "ACTIVE" | "ARCHIVED";
  projectCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectView = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  startDate: string | null;
  deadline: string | null;
  client: {
    id: string;
    name: string;
    status: "ACTIVE" | "ARCHIVED";
  };
  memberCount: number;
  createdAt: string;
  updatedAt: string;
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

export async function addInternalMember(
  admin: ApiClient,
  organizationId: string,
  email: string,
  role: MembershipView["role"],
  name: string,
): Promise<{
  client: ApiClient;
  auth: AuthView;
  membership: MembershipView;
}> {
  const invitation = await inviteMember(admin, organizationId, email, role);
  if (invitation.response.status !== 201) {
    throw new Error(`Failed to invite member: ${JSON.stringify(invitation.response.body)}`);
  }

  const client = await createApiClient();
  const accepted = await client.post("/api/v1/invitations/accept", {
    token: invitation.token,
    name,
    password: PASSWORD,
  });
  if (accepted.status !== 200) {
    throw new Error(`Failed to accept invitation: ${JSON.stringify(accepted.body)}`);
  }

  return {
    client,
    auth: accepted.body as AuthView,
    membership: accepted.body.memberships[0] as MembershipView,
  };
}

export async function createClientRecord(
  client: ApiClient,
  organizationId: string,
  overrides: Partial<{
    name: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
    notes: string;
    brandGuidelines: string;
  }> = {},
): Promise<ClientView> {
  const response = await client.post(`/api/v1/organizations/${organizationId}/clients`, {
    name: overrides.name ?? "Demo Client",
    ...(overrides.contactName ? { contactName: overrides.contactName } : {}),
    ...(overrides.email ? { email: overrides.email } : {}),
    ...(overrides.phone ? { phone: overrides.phone } : {}),
    ...(overrides.website ? { website: overrides.website } : {}),
    ...(overrides.notes ? { notes: overrides.notes } : {}),
    ...(overrides.brandGuidelines ? { brandGuidelines: overrides.brandGuidelines } : {}),
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create client: ${JSON.stringify(response.body)}`);
  }

  return response.body.client as ClientView;
}

export async function createProjectRecord(
  client: ApiClient,
  organizationId: string,
  clientId: string,
  overrides: Partial<{
    name: string;
    description: string;
    startDate: string;
    deadline: string;
  }> = {},
): Promise<ProjectView> {
  const response = await client.post(`/api/v1/organizations/${organizationId}/projects`, {
    clientId,
    name: overrides.name ?? "Demo Project",
    ...(overrides.description ? { description: overrides.description } : {}),
    ...(overrides.startDate ? { startDate: overrides.startDate } : {}),
    ...(overrides.deadline ? { deadline: overrides.deadline } : {}),
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create project: ${JSON.stringify(response.body)}`);
  }

  return response.body.project as ProjectView;
}

export async function inviteClientContact(
  client: ApiClient,
  organizationId: string,
  clientId: string,
  email: string,
): Promise<{ response: request.Response; invitation: InvitationView; token: string }> {
  const response = await client.post(
    `/api/v1/organizations/${organizationId}/clients/${clientId}/invitations`,
    { email },
  );
  const invitation = response.body.invitation as InvitationView | undefined;
  const inviteUrl = response.body.inviteUrl as string | undefined;

  return {
    response,
    invitation: invitation as InvitationView,
    token: inviteUrl ? extractInvitationToken(inviteUrl) : "",
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
  type: "INTERNAL" | "CLIENT";
  role: MembershipView["role"] | null;
  clientId: string | null;
  client: { id: string; name: string; status: "ACTIVE" | "ARCHIVED" } | null;
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
    'TRUNCATE TABLE "audit_logs", "password_reset_tokens", "invitations", "sessions", "project_memberships", "projects", "client_memberships", "clients", "organization_memberships", "organizations", "users" RESTART IDENTITY CASCADE',
  );
}
