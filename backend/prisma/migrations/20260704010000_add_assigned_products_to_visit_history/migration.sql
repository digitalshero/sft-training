-- AlterTable: snapshot cooked products/cuisines per physical-visit attempt
ALTER TABLE "lp_physical_visit_history" ADD COLUMN "assigned_products" JSONB NOT NULL DEFAULT '[]';