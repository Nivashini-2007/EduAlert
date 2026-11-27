/*
  Warnings:

  - Added the required column `updated_at` to the `user_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "OpportunityCategory" ADD VALUE 'HIGHER_EDUCATION';

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "preferred_categories" "OpportunityCategory"[] DEFAULT ARRAY[]::"OpportunityCategory"[],
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;
