-- CreateTable
CREATE TABLE "lp_course_completion_acks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "shown_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_course_completion_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_course_completion_acks_user_id_course_id_key" ON "lp_course_completion_acks"("user_id", "course_id");

-- AddForeignKey
ALTER TABLE "lp_course_completion_acks" ADD CONSTRAINT "lp_course_completion_acks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "lp_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
