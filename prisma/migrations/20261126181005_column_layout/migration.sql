-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "columnOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "columnWidths" JSONB NOT NULL DEFAULT '{}';
