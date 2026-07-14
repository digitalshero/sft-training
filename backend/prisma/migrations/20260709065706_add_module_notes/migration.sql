-- CreateTable
CREATE TABLE "lp_module_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lp_module_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_module_notes_user_id_module_id_key" ON "lp_module_notes"("user_id", "module_id");

-- AddForeignKey
ALTER TABLE "lp_module_notes" ADD CONSTRAINT "lp_module_notes_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "lp_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
