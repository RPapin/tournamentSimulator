-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('ROUND_ROBIN', 'ELIMINATION', 'GROUP_KNOCKOUT');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "groupNum" INTEGER,
ADD COLUMN     "phase" TEXT,
ADD COLUMN     "round" INTEGER;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "format" "TournamentFormat" NOT NULL DEFAULT 'ROUND_ROBIN';
