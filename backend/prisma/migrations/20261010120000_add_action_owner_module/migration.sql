-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionReviewStatus" AS ENUM ('ACTIVE', 'RETURNED_FOR_REVISION', 'COMPLETED_PENDING_VERIFICATION', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('IMMEDIATE', 'CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ActionType" NOT NULL DEFAULT 'CORRECTIVE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "reviewStatus" "ActionReviewStatus" NOT NULL DEFAULT 'ACTIVE',
    "progressNote" TEXT,
    "verificationNotes" TEXT,
    "managerReviewComment" TEXT,
    "completedAt" TIMESTAMP(3),
    "effectiveness" TEXT,
    "effectivenessScore" INTEGER,
    "completionRiskScore" DOUBLE PRECISION,
    "riskExplanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEvidence" (
    "id" SERIAL NOT NULL,
    "actionItemId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionHistory" (
    "id" SERIAL NOT NULL,
    "actionItemId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionNotification" (
    "id" SERIAL NOT NULL,
    "actionItemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionItem_ownerId_status_idx" ON "ActionItem"("ownerId", "status");
CREATE INDEX "ActionItem_dueDate_status_idx" ON "ActionItem"("dueDate", "status");
CREATE INDEX "ActionItem_incidentId_idx" ON "ActionItem"("incidentId");

-- CreateIndex
CREATE INDEX "ActionEvidence_actionItemId_uploadedAt_idx" ON "ActionEvidence"("actionItemId", "uploadedAt");
CREATE INDEX "ActionHistory_actionItemId_createdAt_idx" ON "ActionHistory"("actionItemId", "createdAt");
CREATE UNIQUE INDEX "ActionNotification_actionItemId_userId_type_key" ON "ActionNotification"("actionItemId", "userId", "type");
CREATE INDEX "ActionNotification_userId_readAt_createdAt_idx" ON "ActionNotification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionHistory" ADD CONSTRAINT "ActionHistory_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionHistory" ADD CONSTRAINT "ActionHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionNotification" ADD CONSTRAINT "ActionNotification_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionNotification" ADD CONSTRAINT "ActionNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
