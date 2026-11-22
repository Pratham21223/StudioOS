import type { RequestHandler } from "express";
import {
  createClient,
  getClient,
  listClientMembers,
  listClients,
  updateClient,
  updateClientMember,
} from "./client.service.js";
import type {
  ClientListQuery,
  CreateClientInput,
  UpdateClientInput,
  UpdateClientMembershipInput,
} from "./client.validation.js";

export const getClients: RequestHandler = async (req, res) => {
  const clients = await listClients(req.tenant!, res.locals.query as ClientListQuery);
  res.status(200).json({ clients });
};

export const postClient: RequestHandler = async (req, res) => {
  const client = await createClient(req.tenant!, req.auth!.userId, req.body as CreateClientInput);
  res.status(201).json({ client });
};

export const getClientById: RequestHandler = async (req, res) => {
  const client = await getClient(req.tenant!, req.params.clientId as string);
  res.status(200).json({ client });
};

export const patchClient: RequestHandler = async (req, res) => {
  const client = await updateClient(
    req.tenant!,
    req.auth!.userId,
    req.params.clientId as string,
    req.body as UpdateClientInput,
  );
  res.status(200).json({ client });
};

export const getClientMembers: RequestHandler = async (req, res) => {
  const members = await listClientMembers(req.tenant!, req.params.clientId as string);
  res.status(200).json({ members });
};

export const patchClientMember: RequestHandler = async (req, res) => {
  const member = await updateClientMember(
    req.tenant!,
    req.auth!.userId,
    req.params.clientId as string,
    req.params.membershipId as string,
    req.body as UpdateClientMembershipInput,
  );
  res.status(200).json({ member });
};
