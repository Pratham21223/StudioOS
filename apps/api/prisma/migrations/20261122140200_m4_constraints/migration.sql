-- Additional integrity constraints for assets, reviews, and delivery jobs.

-- Asset uploads and completed assets must reference content from the same project.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_content_item_project_fkey"
  FOREIGN KEY ("content_item_id", "project_id", "organization_id")
  REFERENCES "content_items"("id", "project_id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_uploads"
  ADD CONSTRAINT "asset_uploads_content_item_project_fkey"
  FOREIGN KEY ("content_item_id", "project_id", "organization_id")
  REFERENCES "content_items"("id", "project_id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A review's asset must belong to the reviewed content item.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_id_content_item_id_organization_id_key"
  UNIQUE ("id", "content_item_id", "organization_id");

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_asset_content_match_fkey"
  FOREIGN KEY ("asset_id", "content_item_id", "organization_id")
  REFERENCES "assets"("id", "content_item_id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Basic domain checks.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_size_check" CHECK ("size_bytes" > 0);

ALTER TABLE "asset_uploads"
  ADD CONSTRAINT "asset_uploads_size_check" CHECK ("size_bytes" > 0);

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_content_version_check" CHECK ("content_version" >= 1);

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0);
