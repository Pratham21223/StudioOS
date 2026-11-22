-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientMembershipStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('INTERNAL', 'CLIENT');

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "client_id" UUID,
ADD COLUMN     "type" "InvitationType" NOT NULL DEFAULT 'INTERNAL',
ALTER COLUMN "role" DROP NOT NULL;

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contact_name" VARCHAR(120),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "website" VARCHAR(255),
    "notes" TEXT,
    "brand_guidelines" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ClientMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE,
    "deadline" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_organization_id_status_idx" ON "clients"("organization_id", "status");

-- CreateIndex
CREATE INDEX "clients_organization_id_name_idx" ON "clients"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_organization_id_key" ON "clients"("id", "organization_id");

-- CreateIndex
CREATE INDEX "client_memberships_organization_id_user_id_status_idx" ON "client_memberships"("organization_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "client_memberships_client_id_status_idx" ON "client_memberships"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "client_memberships_client_id_user_id_key" ON "client_memberships"("client_id", "user_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "projects_organization_id_deadline_idx" ON "projects"("organization_id", "deadline");

-- CreateIndex
CREATE INDEX "projects_organization_id_client_id_idx" ON "projects"("organization_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_organization_id_key" ON "projects"("id", "organization_id");

-- CreateIndex
CREATE INDEX "project_memberships_organization_id_user_id_idx" ON "project_memberships"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "project_memberships_project_id_idx" ON "project_memberships"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_memberships_project_id_user_id_key" ON "project_memberships"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "invitations_organization_id_type_idx" ON "invitations"("organization_id", "type");

-- CreateIndex
CREATE INDEX "invitations_client_id_idx" ON "invitations"("client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
