-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "education_levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eligible_states" TEXT[] DEFAULT ARRAY[]::TEXT[];

