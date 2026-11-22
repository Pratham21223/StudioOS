import type { RequestHandler } from "express";
import { getDashboard } from "./dashboard.service.js";

export const getOrganizationDashboard: RequestHandler = async (req, res) => {
  const dashboard = await getDashboard(req.tenant!);
  res.status(200).json({ dashboard });
};
