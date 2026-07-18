-- CreateTable
CREATE TABLE "lp_product_upload_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "files" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_product_upload_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_product_upload_drafts_assignment_id_key" ON "lp_product_upload_drafts"("assignment_id");

-- CreateIndex
CREATE INDEX "lp_product_upload_drafts_user_id_course_id_idx" ON "lp_product_upload_drafts"("user_id", "course_id");
