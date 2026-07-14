-- AlterTable: add visitor_location to physical visits and history
ALTER TABLE "lp_physical_visits" ADD COLUMN "visitor_location" TEXT;
ALTER TABLE "lp_physical_visit_history" ADD COLUMN "visitor_location" TEXT;
