import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

export const pendingRegistrationRepository = {
  findByEmail(email: string, db: DbClient = prisma) {
    return db.pendingRegistration.findUnique({ where: { email } });
  },

  create(
    data: {
      id: string;
      email: string;
      name: string;
      passwordHash: string;
      organizationName: string;
      codeHash: string;
      expiresAt: Date;
      lastSentAt: Date;
    },
    db: DbClient = prisma,
  ) {
    return db.pendingRegistration.create({ data });
  },

  updateCode(
    id: string,
    data: { codeHash: string; expiresAt: Date; lastSentAt: Date },
    db: DbClient = prisma,
  ) {
    return db.pendingRegistration.update({
      where: { id },
      data: { ...data, attempts: 0 },
    });
  },

  incrementAttempts(id: string, db: DbClient = prisma) {
    return db.pendingRegistration.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  deleteExpiredForEmail(email: string, now: Date, db: DbClient = prisma) {
    return db.pendingRegistration.deleteMany({
      where: { email, expiresAt: { lte: now } },
    });
  },

  deleteByEmail(email: string, db: DbClient = prisma) {
    return db.pendingRegistration.deleteMany({ where: { email } });
  },

  /**
   * Atomically consumes the pending registration. Only one concurrent request
   * can delete a row with the expected code hash.
   */
  claim(id: string, codeHash: string, db: DbClient = prisma) {
    return db.pendingRegistration.deleteMany({
      where: { id, codeHash },
    });
  },
};
