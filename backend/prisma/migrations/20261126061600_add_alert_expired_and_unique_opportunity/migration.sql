-- AlterEnum
ALTER TYPE "AlertStatus" ADD VALUE 'EXPIRED';

-- CreateIndex
CREATE UNIQUE INDEX "user_alerts_user_id_opportunity_id_key" ON "user_alerts"("user_id", "opportunity_id");

