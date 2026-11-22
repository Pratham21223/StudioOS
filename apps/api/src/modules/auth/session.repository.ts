import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

export const sessionRepository = {
  create(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    db: DbClient = prisma,
  ) {
    return db.session.create({ data });
  },

  findByTokenHash(tokenHash: string, db: DbClient = prisma) {
    return db.session.findUnique({ where: { tokenHash } });
  },

  deleteById(id: string, db: DbClient = prisma) {
    return db.session.deleteMany({ where: { id } });
  },

  deleteByTokenHash(tokenHash: string, db: DbClient = prisma) {
    return db.session.deleteMany({ where: { tokenHash } });
  },

  deleteAllForUser(userId: string, db: DbClient = prisma) {
    return db.session.deleteMany({ where: { userId } });
  },
};

export const passwordResetRepository = {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }, db: DbClient = prisma) {
    return db.passwordResetToken.create({ data });
  },

  findByTokenHash(tokenHash: string, db: DbClient = prisma) {
    return db.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  deleteUnusedForUser(userId: string, db: DbClient = prisma) {
    return db.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });
  },

  claim(id: string, now: Date, db: DbClient = prisma) {
    return db.passwordResetToken.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
  },
};
