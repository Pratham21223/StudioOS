import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { presentClient, presentClientMembershipWithUser } from "../../shared/presenters.js";
import { recordAudit } from "../audit/audit.service.js";
import { clientMembershipRepository } from "./client-membership.repository.js";
import { clientRepository } from "./client.repository.js";
import type {
  ClientListQuery,
  CreateClientInput,
  UpdateClientInput,
  UpdateClientMembershipInput,
} from "./client.validation.js";

function nullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.length > 0 ? value : null;
}

function auditedClient(client: ReturnType<typeof presentClient>) {
  return {
    name: client.name,
    status: client.status,
    email: client.email,
  };
}

export async function listClients(tenant: TenantContext, query: ClientListQuery) {
  const clients = await clientRepository.list(tenant.organizationId, query);
  return clients.map((client) =>
    presentClient(client, {
      projects: client._count.projects,
      members: client._count.memberships,
    }),
  );
}

export async function getClient(tenant: TenantContext, clientId: string) {
  const client = await clientRepository.findByIdInOrganization(clientId, tenant.organizationId);
  if (!client) {
    throw AppError.notFound("CLIENT_NOT_FOUND", "The requested client was not found.");
  }

  return presentClient(client, {
    projects: client._count.projects,
    members: client._count.memberships,
  });
}

export async function createClient(
  tenant: TenantContext,
  actorId: string,
  input: CreateClientInput,
) {
  return prisma.$transaction(async (tx) => {
    const client = await clientRepository.create(
      {
        organizationId: tenant.organizationId,
        name: input.name,
        contactName: nullable(input.contactName) ?? null,
        email: nullable(input.email) ?? null,
        phone: nullable(input.phone) ?? null,
        website: nullable(input.website) ?? null,
        notes: nullable(input.notes) ?? null,
        brandGuidelines: nullable(input.brandGuidelines) ?? null,
      },
      tx,
    );

    const presented = presentClient(client, { projects: 0, members: 0 });

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "client.created",
      resourceType: "client",
      resourceId: client.id,
      metadata: auditedClient(presented),
    });

    return presented;
  });
}

export async function updateClient(
  tenant: TenantContext,
  actorId: string,
  clientId: string,
  input: UpdateClientInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await clientRepository.findByIdInOrganization(
      clientId,
      tenant.organizationId,
      tx,
    );
    if (!existing) {
      throw AppError.notFound("CLIENT_NOT_FOUND", "The requested client was not found.");
    }

    const data: Prisma.ClientUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.contactName !== undefined) data.contactName = nullable(input.contactName);
    if (input.email !== undefined) data.email = nullable(input.email);
    if (input.phone !== undefined) data.phone = nullable(input.phone);
    if (input.website !== undefined) data.website = nullable(input.website);
    if (input.notes !== undefined) data.notes = nullable(input.notes);
    if (input.brandGuidelines !== undefined) {
      data.brandGuidelines = nullable(input.brandGuidelines);
    }
    if (input.status !== undefined) data.status = input.status;

    const updated = await clientRepository.update(clientId, data, tx);
    const presented = presentClient(updated, {
      projects: updated._count.projects,
      members: updated._count.memberships,
    });

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "client.updated",
      resourceType: "client",
      resourceId: clientId,
      metadata: {
        previousName: existing.name,
        previousStatus: existing.status,
        ...auditedClient(presented),
      },
    });

    return presented;
  });
}

export async function listClientMembers(tenant: TenantContext, clientId: string) {
  const client = await clientRepository.findByIdInOrganization(clientId, tenant.organizationId);
  if (!client) {
    throw AppError.notFound("CLIENT_NOT_FOUND", "The requested client was not found.");
  }

  const members = await clientMembershipRepository.listForClient(tenant.organizationId, clientId);
  return members.map(presentClientMembershipWithUser);
}

export async function updateClientMember(
  tenant: TenantContext,
  actorId: string,
  clientId: string,
  membershipId: string,
  input: UpdateClientMembershipInput,
) {
  return prisma.$transaction(async (tx) => {
    const client = await clientRepository.findByIdInOrganization(
      clientId,
      tenant.organizationId,
      tx,
    );
    if (!client) {
      throw AppError.notFound("CLIENT_NOT_FOUND", "The requested client was not found.");
    }

    const membership = await clientMembershipRepository.findByIdInClient(
      tenant.organizationId,
      clientId,
      membershipId,
      tx,
    );
    if (!membership) {
      throw AppError.notFound(
        "CLIENT_MEMBERSHIP_NOT_FOUND",
        "The requested client membership was not found.",
      );
    }

    if (membership.status === input.status) {
      return presentClientMembershipWithUser(membership);
    }

    const updated = await clientMembershipRepository.update(
      membershipId,
      { status: input.status },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action:
        input.status === "ACTIVE"
          ? "client_membership.reactivated"
          : "client_membership.deactivated",
      resourceType: "client_membership",
      resourceId: membershipId,
      metadata: {
        clientId,
        userId: membership.userId,
        previousStatus: membership.status,
        status: input.status,
      },
    });

    return presentClientMembershipWithUser(updated);
  });
}
