-- AlterTable
ALTER TABLE "group_courses" ADD COLUMN     "endsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "labs" ADD COLUMN     "hints" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "originalName" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "positionSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "videos_lessonId_key" ON "videos"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "videos_fileKey_key" ON "videos"("fileKey");

-- CreateIndex
CREATE INDEX "videos_lessonId_idx" ON "videos"("lessonId");

-- CreateIndex
CREATE INDEX "videos_fileKey_idx" ON "videos"("fileKey");

-- CreateIndex
CREATE INDEX "video_progress_userId_idx" ON "video_progress"("userId");

-- CreateIndex
CREATE INDEX "video_progress_lessonId_idx" ON "video_progress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_userId_lessonId_key" ON "video_progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "courses_isPublished_idx" ON "courses"("isPublished");

-- CreateIndex
CREATE INDEX "courses_accessType_idx" ON "courses"("accessType");

-- CreateIndex
CREATE INDEX "courses_isPublished_accessType_idx" ON "courses"("isPublished", "accessType");

-- CreateIndex
CREATE INDEX "entitlements_userId_revokedAt_endsAt_idx" ON "entitlements"("userId", "revokedAt", "endsAt");

-- CreateIndex
CREATE INDEX "lessons_isFree_idx" ON "lessons"("isFree");

-- CreateIndex
CREATE INDEX "lessons_accessType_idx" ON "lessons"("accessType");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
