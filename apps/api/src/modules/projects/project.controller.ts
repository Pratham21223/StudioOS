import type { RequestHandler } from "express";
import {
  assignProjectMembers,
  createProject,
  getProject,
  listProjectMembers,
  listProjects,
  removeProjectMember,
  updateProject,
} from "./project.service.js";
import type {
  AssignProjectMembersInput,
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
} from "./project.validation.js";

export const getProjects: RequestHandler = async (req, res) => {
  const projects = await listProjects(req.tenant!, res.locals.query as ProjectListQuery);
  res.status(200).json({ projects });
};

export const getProjectById: RequestHandler = async (req, res) => {
  const project = await getProject(req.tenant!, req.params.projectId as string);
  res.status(200).json({ project });
};

export const postProject: RequestHandler = async (req, res) => {
  const project = await createProject(
    req.tenant!,
    req.auth!.userId,
    req.body as CreateProjectInput,
  );
  res.status(201).json({ project });
};

export const patchProject: RequestHandler = async (req, res) => {
  const project = await updateProject(
    req.tenant!,
    req.auth!.userId,
    req.params.projectId as string,
    req.body as UpdateProjectInput,
  );
  res.status(200).json({ project });
};

export const getProjectMembers: RequestHandler = async (req, res) => {
  const members = await listProjectMembers(req.tenant!, req.params.projectId as string);
  res.status(200).json({ members });
};

export const postProjectMembers: RequestHandler = async (req, res) => {
  const members = await assignProjectMembers(
    req.tenant!,
    req.auth!.userId,
    req.params.projectId as string,
    req.body as AssignProjectMembersInput,
  );
  res.status(200).json({ members });
};

export const deleteProjectMember: RequestHandler = async (req, res) => {
  const result = await removeProjectMember(
    req.tenant!,
    req.auth!.userId,
    req.params.projectId as string,
    req.params.userId as string,
  );
  res.status(200).json(result);
};
