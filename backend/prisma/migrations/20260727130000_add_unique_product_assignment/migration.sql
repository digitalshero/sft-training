-- This migration assumes backend/cleanup-duplicate-assignments.ts --apply
-- has already been run against this database. If duplicate assignment
-- groups still exist, abort loudly rather than silently picking a row to
-- keep here — that decision (reviewed submission history, draft state,
-- certified-partner exclusion, etc.) belongs in the cleanup script, not in
-- a migration.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id, course_id, cuisine_id, recipe_id
    FROM lp_product_assignments
    GROUP BY user_id, course_id, cuisine_id, recipe_id
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'lp_product_assignments still has % duplicate group(s) — run backend/cleanup-duplicate-assignments.ts --apply first', dup_count;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "lp_product_assignments_user_id_course_id_cuisine_id_recipe_id_key" ON "lp_product_assignments"("user_id", "course_id", "cuisine_id", "recipe_id");
