import type { RequestHandler } from "express";
import { presentMembershipWithUser } from "../../shared/presenters.js";
import { listMembers, updateMember } from "./membership.service.js";
import type { UpdateMembershipInput } from "./membership.validation.js";

export const listOrganizationMembers: RequestHandler = async (req, res) => {
  const members = await listMembers(req.tenant!);
  res.status(200).json({ members: members.map(presentMembershipWithUser) });
};

export const patchOrganizationMember: RequestHandler = async (req, res) => {
  const membershipId = req.params.membershipId as string;
  const membership = await updateMember(
    req.tenant!,
    req.auth!.userId,
    membershipId,
    req.body as UpdateMembershipInput,
  );

  res.status(200).json({ member: presentMembershipWithUser(membership) });
};
