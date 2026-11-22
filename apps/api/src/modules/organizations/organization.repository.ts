import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

export const organizationRepository = {
  findById(id: string, db: DbClient = prisma) {
    return db.organization.findUnique({ where: { id } });
  },

  findBySlug(slug: string, db: DbClient = prisma) {
    return db.organization.findUnique({ where: { slug } });
  },

  updateName(id: string, name: string, db: DbClient = prisma) {
    return db.organization.update({ where: { id }, data: { name } });
  },
};
