-- AlterTable
ALTER TABLE "partner_payments" ADD COLUMN     "external_partner_id" TEXT;

-- CreateIndex
CREATE INDEX "email_send_log_template_name_status_created_at_idx" ON "email_send_log"("template_name", "status", "created_at");

-- CreateIndex
CREATE INDEX "email_send_log_recipient_email_idx" ON "email_send_log"("recipient_email");
