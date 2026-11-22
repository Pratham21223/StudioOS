import type { RequestHandler } from "express";
import {
  createContent,
  getContent,
  listContent,
  listContentHistory,
  listProjectContent,
  transitionContent,
  updateContent,
} from "./content.service.js";
import type {
  ContentListQuery,
  CreateContentInput,
  TransitionContentInput,
  UpdateContentInput,
} from "./content.validation.js";

export const getContentItems: RequestHandler = async (req, res) => {
  const content = await listContent(req.tenant!, res.locals.query as ContentListQuery);
  res.status(200).json({ content });
};

export const getProjectContent: RequestHandler = async (req, res) => {
  const content = await listProjectContent(
    req.tenant!,
    req.params.projectId as string,
    res.locals.query as ContentListQuery,
  );
  res.status(200).json({ content });
};

export const getContentById: RequestHandler = async (req, res) => {
  const content = await getContent(req.tenant!, req.params.contentId as string);
  res.status(200).json({ content });
};

export const getContentEvents: RequestHandler = async (req, res) => {
  const events = await listContentHistory(req.tenant!, req.params.contentId as string);
  res.status(200).json({ events });
};

export const postProjectContent: RequestHandler = async (req, res) => {
  const content = await createContent(
    req.tenant!,
    req.auth!.userId,
    req.params.projectId as string,
    req.body as CreateContentInput,
  );
  res.status(201).json({ content });
};

export const patchContent: RequestHandler = async (req, res) => {
  const content = await updateContent(
    req.tenant!,
    req.auth!.userId,
    req.params.contentId as string,
    req.body as UpdateContentInput,
  );
  res.status(200).json({ content });
};

export const postContentTransition: RequestHandler = async (req, res) => {
  const result = await transitionContent(
    req.tenant!,
    req.auth!.userId,
    req.params.contentId as string,
    req.body as TransitionContentInput,
  );
  res.status(200).json(result);
};
