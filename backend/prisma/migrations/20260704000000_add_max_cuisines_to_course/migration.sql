-- AlterTable: add max_cuisines cap to courses (null = unlimited)
ALTER TABLE "lp_courses" ADD COLUMN "max_cuisines" INTEGER;