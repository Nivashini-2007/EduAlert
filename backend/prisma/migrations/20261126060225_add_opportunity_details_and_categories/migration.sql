-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OpportunityCategory" ADD VALUE 'RESULT';
ALTER TYPE "OpportunityCategory" ADD VALUE 'ADMIT_CARD';

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "application_procedure" TEXT,
ADD COLUMN     "required_documents" TEXT[] DEFAULT ARRAY[]::TEXT[];
