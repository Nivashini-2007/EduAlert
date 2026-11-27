-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REMINDER', 'DAILY_DIGEST', 'OPPORTUNITY_UPDATE', 'TEST');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dedupe_key" VARCHAR(255),
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opportunity_id" UUID,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" VARCHAR(255) NOT NULL DEFAULT 'EduAlert Reminder',
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'REMINDER',
ALTER COLUMN "alert_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "device_label" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_device_tokens_token_key" ON "user_device_tokens"("token");

-- CreateIndex
CREATE INDEX "user_device_tokens_user_id_is_active_idx" ON "user_device_tokens"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_opportunity_id_idx" ON "notifications"("opportunity_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_device_tokens" ADD CONSTRAINT "user_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

