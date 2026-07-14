-- AlterTable
ALTER TABLE "lp_physical_visits" ADD COLUMN     "product_ids" JSONB NOT NULL DEFAULT '[]';
