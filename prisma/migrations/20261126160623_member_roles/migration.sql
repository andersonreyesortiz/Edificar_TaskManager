-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('EDITOR', 'COLLABORATOR');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "autoGroupByStatus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BoardMember" ADD COLUMN     "role" "BoardRole" NOT NULL DEFAULT 'COLLABORATOR';

-- AlterTable
ALTER TABLE "TaskAssignee" ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "assignedById" TEXT;
