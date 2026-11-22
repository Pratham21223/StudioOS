import type { Request } from "express";

export type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getRequestMeta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip ? req.ip.slice(0, 45) : null,
    userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
  };
}
