-- CreateTable
CREATE TABLE "sft_invites" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "partner_email" TEXT NOT NULL,
    "location" TEXT,
    "invite_link" TEXT,
    "paid_status" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sft_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sft_invites_invoice_number_key" ON "sft_invites"("invoice_number");

-- CreateIndex
CREATE INDEX "sft_invites_partner_email_idx" ON "sft_invites"("partner_email");
