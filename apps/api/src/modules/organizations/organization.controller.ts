import type { RequestHandler } from "express";
import { presentMembershipWithOrganization, presentOrganization } from "../../shared/presenters.js";
import {
  getOrganization,
  listMyOrganizations,
  updateOrganization,
} from "./organization.service.js";
import type { UpdateOrganizationInput } from "./organization.validation.js";

export const listOrganizations: RequestHandler = async (req, res) => {
  const memberships = await listMyOrganizations(req.auth!.userId);
  res.status(200).json({
    organizations: memberships.map(presentMembershipWithOrganization),
  });
};

export const getOrganizationById: RequestHandler = async (req, res) => {
  const result = await getOrganization(req.tenant!);
  res.status(200).json({
    organization: presentOrganization(result.organization),
    membership: result.membership,
  });
};

export const patchOrganization: RequestHandler = async (req, res) => {
  const organization = await updateOrganization(
    req.tenant!,
    req.auth!.userId,
    req.body as UpdateOrganizationInput,
  );
  res.status(200).json({ organization: presentOrganization(organization) });
};
