-- CreateTable
CREATE TABLE "lp_day_completion_acks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "shown_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_day_completion_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_day_completion_acks_user_id_day_id_key" ON "lp_day_completion_acks"("user_id", "day_id");

-- AddForeignKey
ALTER TABLE "lp_day_completion_acks" ADD CONSTRAINT "lp_day_completion_acks_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "lp_course_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
