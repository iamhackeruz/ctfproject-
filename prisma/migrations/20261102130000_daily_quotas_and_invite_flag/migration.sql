-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registeredWithInvite" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_resource_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "terminalMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastTerminalAt" TIMESTAMP(3),
    "lastLabAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_resource_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_resource_usages_userId_date_key" ON "daily_resource_usages"("userId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_resource_usages_userId_date_idx" ON "daily_resource_usages"("userId", "date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_resource_usages_userId_fkey'
    ) THEN
        ALTER TABLE "daily_resource_usages" ADD CONSTRAINT "daily_resource_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
