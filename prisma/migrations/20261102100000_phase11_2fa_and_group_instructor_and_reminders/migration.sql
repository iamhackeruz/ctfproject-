-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "instructorId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupKey" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twoFactorLastUsedStep" BIGINT,
ADD COLUMN     "twoFactorLockoutUntil" TIMESTAMP(3),
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "twoFactorTempSecret" TEXT;

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_userId_used_idx" ON "two_factor_backup_codes"("userId", "used");

-- CreateIndex
CREATE INDEX "assignments_groupId_isPublished_idx" ON "assignments"("groupId", "isPublished");

-- CreateIndex
CREATE INDEX "assignments_createdById_idx" ON "assignments"("createdById");

-- CreateIndex
CREATE INDEX "groups_instructorId_idx" ON "groups"("instructorId");

-- CreateIndex
CREATE INDEX "groups_createdBy_idx" ON "groups"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupKey_key" ON "notifications"("dedupKey");

-- CreateIndex
CREATE INDEX "notifications_dedupKey_idx" ON "notifications"("dedupKey");

-- CreateIndex
CREATE INDEX "submissions_userId_status_idx" ON "submissions"("userId", "status");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
