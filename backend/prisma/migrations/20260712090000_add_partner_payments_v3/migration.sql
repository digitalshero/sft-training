-- CreateTable
CREATE TABLE "partner_payments" (
    "id" TEXT NOT NULL,
    "partner_name" TEXT NOT NULL,
    "partner_email" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "invite_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_invites" (
    "id" TEXT NOT NULL,
    "partner_payment_id" TEXT NOT NULL,
    "partner_email" TEXT NOT NULL,
    "invite_token" TEXT NOT NULL,
    "invite_link" TEXT,
    "invite_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_otp" (
    "id" TEXT NOT NULL,
    "partner_email" TEXT NOT NULL,
    "otp_code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_status" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_payments_payment_id_key" ON "partner_payments"("payment_id");

-- CreateIndex
CREATE INDEX "partner_payments_partner_email_idx" ON "partner_payments"("partner_email");

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_partner_payment_id_key" ON "partner_invites"("partner_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_invite_token_key" ON "partner_invites"("invite_token");

-- CreateIndex
CREATE INDEX "partner_invites_partner_email_idx" ON "partner_invites"("partner_email");

-- CreateIndex
CREATE INDEX "partner_otp_partner_email_idx" ON "partner_otp"("partner_email");

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_partner_payment_id_fkey" FOREIGN KEY ("partner_payment_id") REFERENCES "partner_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
