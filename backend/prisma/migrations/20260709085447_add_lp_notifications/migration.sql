-- CreateTable
CREATE TABLE "lp_notifications" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "lp_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lp_notifications_partner_id_status_idx" ON "lp_notifications"("partner_id", "status");

-- CreateIndex
CREATE INDEX "lp_notifications_partner_id_module_name_idx" ON "lp_notifications"("partner_id", "module_name");
