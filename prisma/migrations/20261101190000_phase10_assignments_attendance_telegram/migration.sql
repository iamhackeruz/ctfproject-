/*
  Warnings:

  - A unique constraint covering the columns `[telegramChatId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT_NEW', 'ASSIGNMENT_DUE_SOON', 'SUBMISSION_GRADED', 'SUBMISSION_RETURNED', 'LESSON_PUBLISHED', 'ENTITLEMENT_EXPIRING', 'PASSWORD_RESET', 'SUBMISSION_NEW');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'IN_APP', 'BOTH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramConnectedAt" TIMESTAMP(3),
ADD COLUMN     "telegramUsername" TEXT;

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "courseId" INTEGER,
    "groupId" TEXT,
    "lessonId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "allowFileUpload" BOOLEAN NOT NULL DEFAULT true,
    "allowedFileTypes" TEXT NOT NULL DEFAULT 'txt,md,pdf,zip,png,jpg,py,sh',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false,
    "latePenaltyPercent" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_extensions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extendedDueAt" TIMESTAMP(3) NOT NULL,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "textContent" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "instructorFeedback" TEXT,
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_history" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "textContent" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "instructorFeedback" TEXT,

    CONSTRAINT "submission_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "topic" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "markedById" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_connect_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_connect_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyAssignmentNew" BOOLEAN NOT NULL DEFAULT true,
    "notifyDueSoon" BOOLEAN NOT NULL DEFAULT true,
    "notifyGraded" BOOLEAN NOT NULL DEFAULT true,
    "notifyLessonPublished" BOOLEAN NOT NULL DEFAULT true,
    "notifyExpiring" BOOLEAN NOT NULL DEFAULT true,
    "notifyPasswordReset" BOOLEAN NOT NULL DEFAULT true,
    "notifySubmissionNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'BOTH',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "error" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignments_courseId_idx" ON "assignments"("courseId");

-- CreateIndex
CREATE INDEX "assignments_groupId_idx" ON "assignments"("groupId");

-- CreateIndex
CREATE INDEX "assignments_lessonId_idx" ON "assignments"("lessonId");

-- CreateIndex
CREATE INDEX "assignments_isPublished_idx" ON "assignments"("isPublished");

-- CreateIndex
CREATE INDEX "assignments_dueAt_idx" ON "assignments"("dueAt");

-- CreateIndex
CREATE INDEX "assignment_extensions_assignmentId_idx" ON "assignment_extensions"("assignmentId");

-- CreateIndex
CREATE INDEX "assignment_extensions_userId_idx" ON "assignment_extensions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_extensions_assignmentId_userId_key" ON "assignment_extensions"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "submissions_assignmentId_status_idx" ON "submissions"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "submissions_userId_idx" ON "submissions"("userId");

-- CreateIndex
CREATE INDEX "submissions_submittedAt_idx" ON "submissions"("submittedAt");

-- CreateIndex
CREATE INDEX "submissions_isLate_idx" ON "submissions"("isLate");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignmentId_userId_key" ON "submissions"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "submission_history_submissionId_version_idx" ON "submission_history"("submissionId", "version");

-- CreateIndex
CREATE INDEX "class_sessions_groupId_sessionDate_idx" ON "class_sessions"("groupId", "sessionDate");

-- CreateIndex
CREATE INDEX "class_sessions_createdById_idx" ON "class_sessions"("createdById");

-- CreateIndex
CREATE INDEX "attendance_records_sessionId_idx" ON "attendance_records"("sessionId");

-- CreateIndex
CREATE INDEX "attendance_records_userId_idx" ON "attendance_records"("userId");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_sessionId_userId_key" ON "attendance_records"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_connect_codes_codeHash_key" ON "telegram_connect_codes"("codeHash");

-- CreateIndex
CREATE INDEX "telegram_connect_codes_userId_idx" ON "telegram_connect_codes"("userId");

-- CreateIndex
CREATE INDEX "telegram_connect_codes_expiresAt_idx" ON "telegram_connect_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_extensions" ADD CONSTRAINT "assignment_extensions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_extensions" ADD CONSTRAINT "assignment_extensions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_extensions" ADD CONSTRAINT "assignment_extensions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_history" ADD CONSTRAINT "submission_history_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_connect_codes" ADD CONSTRAINT "telegram_connect_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
