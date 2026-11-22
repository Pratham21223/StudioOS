-- Additional integrity constraints for content, workflow, and tasks.
-- These are not expressible in the Prisma schema.

-- A task that references a content item must reference one in the same project.
ALTER TABLE "content_items"
  ADD CONSTRAINT "content_items_id_project_id_organization_id_key"
  UNIQUE ("id", "project_id", "organization_id");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_content_item_project_fkey"
  FOREIGN KEY ("content_item_id", "project_id", "organization_id")
  REFERENCES "content_items"("id", "project_id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The workflow is fixed for the MVP. Reject any state pair that is not in
-- the documented state machine, even through direct database access.
ALTER TABLE "workflow_events"
  ADD CONSTRAINT "workflow_events_transition_check"
  CHECK (
    ("from_status" = 'BRIEF' AND "to_status" = 'SCRIPT')
    OR ("from_status" = 'SCRIPT' AND "to_status" = 'SHOOT')
    OR ("from_status" = 'SHOOT' AND "to_status" = 'EDITING')
    OR ("from_status" = 'EDITING' AND "to_status" = 'INTERNAL_REVIEW')
    OR ("from_status" = 'INTERNAL_REVIEW' AND "to_status" = 'EDITING')
    OR ("from_status" = 'INTERNAL_REVIEW' AND "to_status" = 'CLIENT_APPROVAL')
    OR ("from_status" = 'CLIENT_APPROVAL' AND "to_status" = 'EDITING')
    OR ("from_status" = 'CLIENT_APPROVAL' AND "to_status" = 'READY_TO_PUBLISH')
  );

-- Versions start at 1 and only increase through transitions.
ALTER TABLE "content_items"
  ADD CONSTRAINT "content_items_version_check"
  CHECK ("version" >= 1);
