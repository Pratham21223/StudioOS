import type { RequestHandler } from "express";
import { prisma } from "../infrastructure/database/prisma.js";
import { hashToken } from "../shared/crypto.js";
import { AppError } from "../shared/errors.js";
import { getSessionToken } from "../shared/cookies.js";
import type { AuthContext } from "../shared/context.js";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

async function resolveSession(token: string): Promise<AuthContext | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (session.user.status !== "ACTIVE" || !session.user.emailVerifiedAt) return null;

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    void prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    sessionId: session.id,
    userId: session.user.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      status: session.user.status,
    },
  };
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = getSessionToken(req);
  if (!token) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue."));
    return;
  }

  const auth = await resolveSession(token);
  if (!auth) {
    next(new AppError(401, "SESSION_EXPIRED", "Your session has expired. Sign in again."));
    return;
  }

  req.auth = auth;
  next();
};

export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  const token = getSessionToken(req);
  if (token) {
    const auth = await resolveSession(token);
    if (auth) req.auth = auth;
  }
  next();
};
