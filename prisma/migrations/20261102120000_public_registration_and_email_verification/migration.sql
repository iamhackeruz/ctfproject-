-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "verificationTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationExpires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "registrationIp" TEXT;
ALTER TABLE "users" ADD COLUMN "dailyTerminalQuotaMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "users" ADD COLUMN "dailyLabQuotaMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateIndex
CREATE UNIQUE INDEX "users_verificationTokenHash_key" ON "users"("verificationTokenHash");

-- CreateIndex
CREATE INDEX "users_emailVerified_idx" ON "users"("emailVerified");

-- CreateIndex
CREATE INDEX "users_registrationIp_createdAt_idx" ON "users"("registrationIp", "createdAt");
