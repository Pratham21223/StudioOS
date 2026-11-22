import type { RequestHandler } from "express";
import {
  approvePortalContent,
  createPortalDownloadUrl,
  getPortalContent,
  listPortalProjectContent,
  listPortalProjects,
  requestPortalRevision,
} from "./portal.service.js";
import type { PortalDecisionInput, PortalRevisionInput } from "./portal.validation.js";

export const getPortalProjects: RequestHandler = async (req, res) => {
  const projects = await listPortalProjects(req.auth!.userId);
  res.status(200).json({ projects });
};

export const getPortalProjectContent: RequestHandler = async (req, res) => {
  const result = await listPortalProjectContent(req.auth!.userId, req.params.projectId as string);
  res.status(200).json(result);
};

export const getPortalContentById: RequestHandler = async (req, res) => {
  const content = await getPortalContent(req.auth!.userId, req.params.contentId as string);
  res.status(200).json({ content });
};

export const postPortalApprove: RequestHandler = async (req, res) => {
  const result = await approvePortalContent(
    req.auth!.userId,
    req.params.contentId as string,
    req.body as PortalDecisionInput,
  );
  res.status(200).json(result);
};

export const postPortalRevision: RequestHandler = async (req, res) => {
  const result = await requestPortalRevision(
    req.auth!.userId,
    req.params.contentId as string,
    req.body as PortalRevisionInput,
  );
  res.status(200).json(result);
};

export const postPortalDownloadUrl: RequestHandler = async (req, res) => {
  const disposition = req.body?.disposition === "inline" ? "inline" : "attachment";
  const download = await createPortalDownloadUrl(
    req.auth!.userId,
    req.params.assetId as string,
    disposition,
  );
  res.status(200).json(download);
};
