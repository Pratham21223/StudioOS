-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_client_id_fkey";

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_client_id_organization_id_fkey" FOREIGN KEY ("client_id", "organization_id") REFERENCES "clients"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
