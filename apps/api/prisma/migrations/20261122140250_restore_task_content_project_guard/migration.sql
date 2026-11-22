-- Re-apply the M3 cross-project content guard after the M4 Prisma migration
-- regenerated the tasks foreign keys. DROP IF EXISTS keeps fresh databases and
-- already-migrated databases on the same path.
ALTER TABLE "tasks"
  DROP CONSTRAINT IF EXISTS "tasks_content_item_project_fkey";

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_content_item_project_fkey"
  FOREIGN KEY ("content_item_id", "project_id", "organization_id")
  REFERENCES "content_items"("id", "project_id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
