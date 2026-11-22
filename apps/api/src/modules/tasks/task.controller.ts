import type { RequestHandler } from "express";
import { createTask, getTask, listTasks, updateTask, updateTaskStatus } from "./task.service.js";
import type {
  CreateTaskInput,
  TaskListQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "./task.validation.js";

export const getTasks: RequestHandler = async (req, res) => {
  const tasks = await listTasks(req.tenant!, res.locals.query as TaskListQuery);
  res.status(200).json({ tasks });
};

export const getTaskById: RequestHandler = async (req, res) => {
  const task = await getTask(req.tenant!, req.params.taskId as string);
  res.status(200).json({ task });
};

export const postTask: RequestHandler = async (req, res) => {
  const task = await createTask(req.tenant!, req.auth!.userId, req.body as CreateTaskInput);
  res.status(201).json({ task });
};

export const patchTask: RequestHandler = async (req, res) => {
  const task = await updateTask(
    req.tenant!,
    req.auth!.userId,
    req.params.taskId as string,
    req.body as UpdateTaskInput,
  );
  res.status(200).json({ task });
};

export const patchTaskStatus: RequestHandler = async (req, res) => {
  const task = await updateTaskStatus(
    req.tenant!,
    req.auth!.userId,
    req.params.taskId as string,
    req.body as UpdateTaskStatusInput,
  );
  res.status(200).json({ task });
};
