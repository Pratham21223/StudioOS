import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export const userRepository = {
  findByEmail(email: string, db: DbClient = prisma) {
    return db.user.findUnique({ where: { email } });
  },

  findById(id: string, db: DbClient = prisma) {
    return db.user.findUnique({ where: { id } });
  },

  create(data: { name: string; email: string; passwordHash: string }, db: DbClient = prisma) {
    return db.user.create({ data });
  },

  updatePassword(userId: string, passwordHash: string, db: DbClient = prisma) {
    return db.user.update({ where: { id: userId }, data: { passwordHash } });
  },
};
