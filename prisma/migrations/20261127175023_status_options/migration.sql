-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'APPROVED';
ALTER TYPE "TaskStatus" ADD VALUE 'REJECTED';
ALTER TYPE "TaskStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "statusConfig" JSONB NOT NULL DEFAULT '{}';
