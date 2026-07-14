-- AlterTable
ALTER TABLE "lp_physical_visit_history" ADD COLUMN     "accepted_products" INTEGER,
ADD COLUMN     "inspection_percentage" DOUBLE PRECISION,
ADD COLUMN     "product_inspections" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "rejected_products" INTEGER,
ADD COLUMN     "total_products" INTEGER;

-- AlterTable
ALTER TABLE "lp_physical_visit_photos" ADD COLUMN     "product_id" TEXT;

-- AlterTable
ALTER TABLE "lp_physical_visits" ADD COLUMN     "accepted_products" INTEGER,
ADD COLUMN     "inspection_percentage" DOUBLE PRECISION,
ADD COLUMN     "rejected_products" INTEGER,
ADD COLUMN     "total_products" INTEGER;

-- CreateTable
CREATE TABLE "lp_physical_visit_product_inspections" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_physical_visit_product_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_physical_visit_product_inspections_visit_id_attempt_no_p_key" ON "lp_physical_visit_product_inspections"("visit_id", "attempt_no", "product_id");

-- AddForeignKey
ALTER TABLE "lp_physical_visit_product_inspections" ADD CONSTRAINT "lp_physical_visit_product_inspections_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "lp_physical_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
