-- AlterTable
ALTER TABLE "lp_courses" ADD COLUMN     "certificate_templates" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "lp_partner_certificates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "lp_partner_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_partner_certificates_code_key" ON "lp_partner_certificates"("code");

-- CreateIndex
CREATE INDEX "lp_partner_certificates_user_id_idx" ON "lp_partner_certificates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lp_partner_certificates_user_id_course_id_template_id_key" ON "lp_partner_certificates"("user_id", "course_id", "template_id");

-- AddForeignKey
ALTER TABLE "lp_partner_certificates" ADD CONSTRAINT "lp_partner_certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
