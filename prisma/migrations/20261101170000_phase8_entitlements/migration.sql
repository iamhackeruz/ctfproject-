-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('FREE', 'PREMIUM', 'PAID_COURSE');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('SUBSCRIPTION', 'COURSE', 'GROUP', 'GRANT');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('MANUAL', 'GROUP', 'PAYMENT');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "accessType" "AccessType" NOT NULL DEFAULT 'FREE',
ADD COLUMN "priceUzs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN "accessType" "AccessType" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "labs" ADD COLUMN "accessType" "AccessType" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "interval" "PlanInterval" NOT NULL,
    "priceUzs" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EntitlementType" NOT NULL,
    "courseId" INTEGER,
    "planId" TEXT,
    "groupId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "source" "EntitlementSource" NOT NULL DEFAULT 'MANUAL',
    "grantedBy" TEXT,
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "entitlements_userId_type_idx" ON "entitlements"("userId", "type");

-- CreateIndex
CREATE INDEX "entitlements_userId_courseId_idx" ON "entitlements"("userId", "courseId");

-- CreateIndex
CREATE INDEX "entitlements_groupId_idx" ON "entitlements"("groupId");

-- CreateIndex
CREATE INDEX "entitlements_endsAt_idx" ON "entitlements"("endsAt");

-- CreateIndex
CREATE INDEX "entitlements_revokedAt_idx" ON "entitlements"("revokedAt");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
