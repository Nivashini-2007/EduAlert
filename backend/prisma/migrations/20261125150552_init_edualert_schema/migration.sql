-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "OpportunityCategory" AS ENUM ('SCHOLARSHIP', 'INTERNSHIP', 'GOVT_EXAM', 'FELLOWSHIP', 'COMPETITION', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "education_level" VARCHAR(100),
    "course" VARCHAR(150),
    "institution" VARCHAR(200),
    "state" VARCHAR(100),
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "OpportunityCategory" NOT NULL,
    "eligibility" TEXT NOT NULL,
    "application_start_date" TIMESTAMPTZ(6),
    "application_deadline" TIMESTAMPTZ(6),
    "official_source_url" VARCHAR(500) NOT NULL,
    "source_name" VARCHAR(150) NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "last_verified_at" TIMESTAMPTZ(6),
    "status" "OpportunityStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_opportunities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "saved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMPTZ(6) NOT NULL,
    "category" "OpportunityCategory" NOT NULL DEFAULT 'OTHER',
    "reminder_frequency" "ReminderFrequency" NOT NULL DEFAULT 'ONCE',
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "user_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_preferences" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "user_profiles_state_idx" ON "user_profiles"("state");

-- CreateIndex
CREATE INDEX "user_profiles_education_level_idx" ON "user_profiles"("education_level");

-- CreateIndex
CREATE INDEX "opportunities_category_idx" ON "opportunities"("category");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_verification_status_idx" ON "opportunities"("verification_status");

-- CreateIndex
CREATE INDEX "opportunities_application_deadline_idx" ON "opportunities"("application_deadline");

-- CreateIndex
CREATE INDEX "opportunities_category_status_application_deadline_idx" ON "opportunities"("category", "status", "application_deadline");

-- CreateIndex
CREATE INDEX "opportunities_created_at_idx" ON "opportunities"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_title_official_source_url_key" ON "opportunities"("title", "official_source_url");

-- CreateIndex
CREATE INDEX "saved_opportunities_user_id_idx" ON "saved_opportunities"("user_id");

-- CreateIndex
CREATE INDEX "saved_opportunities_opportunity_id_idx" ON "saved_opportunities"("opportunity_id");

-- CreateIndex
CREATE INDEX "saved_opportunities_saved_at_idx" ON "saved_opportunities"("saved_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_opportunities_user_id_opportunity_id_key" ON "saved_opportunities"("user_id", "opportunity_id");

-- CreateIndex
CREATE INDEX "user_alerts_user_id_idx" ON "user_alerts"("user_id");

-- CreateIndex
CREATE INDEX "user_alerts_opportunity_id_idx" ON "user_alerts"("opportunity_id");

-- CreateIndex
CREATE INDEX "user_alerts_event_date_idx" ON "user_alerts"("event_date");

-- CreateIndex
CREATE INDEX "user_alerts_status_idx" ON "user_alerts"("status");

-- CreateIndex
CREATE INDEX "user_alerts_user_id_status_event_date_idx" ON "user_alerts"("user_id", "status", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "user_alerts_user_id_title_event_date_key" ON "user_alerts"("user_id", "title", "event_date");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_alert_id_idx" ON "notifications"("alert_id");

-- CreateIndex
CREATE INDEX "notifications_status_scheduled_at_idx" ON "notifications"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_alert_id_scheduled_at_key" ON "notifications"("alert_id", "scheduled_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "user_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
