-- CreateTable
CREATE TABLE "base_products" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "cuisine_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Prepare the below listed bases, refer to HDM 2 Chart in downloads - post in app - get approval - start preparing the items under Product to cook',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "base_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_base_products" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "cuisine_id" TEXT NOT NULL,
    "base_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "partner_base_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_product_upload_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "partner_base_product_id" TEXT NOT NULL,
    "files" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "base_product_upload_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_product_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "files" JSONB NOT NULL DEFAULT '[]',
    "feedback" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "base_product_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_products_rollout" (
    "id" INTEGER NOT NULL,
    "launched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "base_products_rollout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "base_products_cuisine_id_name_key" ON "base_products"("cuisine_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "base_product_upload_drafts_partner_base_product_id_key" ON "base_product_upload_drafts"("partner_base_product_id");

-- CreateIndex
CREATE INDEX "base_product_upload_drafts_user_id_course_id_idx" ON "base_product_upload_drafts"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_base_products_user_id_course_id_cuisine_id_base_pr_key" ON "partner_base_products"("user_id", "course_id", "cuisine_id", "base_product_id");

-- CreateIndex
CREATE INDEX "partner_base_products_user_id_course_id_idx" ON "partner_base_products"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "base_product_submissions_user_id_course_id_idx" ON "base_product_submissions"("user_id", "course_id");

-- AddForeignKey
ALTER TABLE "base_products" ADD CONSTRAINT "base_products_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "base_products" ADD CONSTRAINT "base_products_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "lp_cuisines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stamp the rollout row at the moment this migration is actually applied —
-- this timestamp is the sole source of truth for "was this cuisine selection
-- made before Base Products existed," so it must be set here, atomically,
-- rather than guessed or hand-entered after the fact.
INSERT INTO "base_products_rollout" ("id", "launched_at") VALUES (1, CURRENT_TIMESTAMP);
