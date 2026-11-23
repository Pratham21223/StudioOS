import type { EmailOtpPurpose } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

export const emailOtpRepository = {
  create(
    data: {
      userId: string;
      purpose?: EmailOtpPurpose;
      codeHash: string;
      expiresAt: Date;
    },
    db: DbClient = prisma,
  ) {
    return db.emailOtpCode.create({ data });
  },

  findLatestActive(userId: string, purpose: EmailOtpPurpose, db: DbClient = prisma) {
    return db.emailOtpCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  findLatest(userId: string, purpose: EmailOtpPurpose, db: DbClient = prisma) {
    return db.emailOtpCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: "desc" },
    });
  },

  deleteActiveForUser(userId: string, purpose: EmailOtpPurpose, db: DbClient = prisma) {
    return db.emailOtpCode.deleteMany({
      where: { userId, purpose, consumedAt: null },
    });
  },

  incrementAttempts(id: string, db: DbClient = prisma) {
    return db.emailOtpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  claim(id: string, now: Date, db: DbClient = prisma) {
    return db.emailOtpCode.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
  },
};
