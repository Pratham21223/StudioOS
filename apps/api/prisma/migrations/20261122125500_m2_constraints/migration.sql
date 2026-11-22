-- Constraints that are not expressible in the Prisma schema.

-- Internal invitations carry an organization role and no client.
-- Client invitations target exactly one client and carry no internal role.
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_type_shape_check"
  CHECK (
    ("type" = 'INTERNAL' AND "role" IS NOT NULL AND "client_id" IS NULL)
    OR
    ("type" = 'CLIENT' AND "role" IS NULL AND "client_id" IS NOT NULL)
  );

-- A project cannot end before it starts.
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_dates_check"
  CHECK ("start_date" IS NULL OR "deadline" IS NULL OR "start_date" <= "deadline");
