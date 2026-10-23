-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "InvestigationMethod" AS ENUM ('FIVE_WHYS', 'FISHBONE', 'FAULT_TREE', 'TIMELINE_ANALYSIS', 'OTHER');

-- CreateEnum
CREATE TYPE "AiFeedbackAction" AS ENUM ('ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Investigation" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "leadInvestigatorId" INTEGER NOT NULL,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "method" "InvestigationMethod",
    "methodOther" TEXT,
    "findingsSummary" TEXT,
    "rootCauseCategory" TEXT,
    "rootCauseSubcategory" TEXT,
    "rootCauseDescription" TEXT,
    "rootCauseMethod" "InvestigationMethod",
    "rootCauseDetail" TEXT,
    "systemicIssue" BOOLEAN NOT NULL DEFAULT false,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationTeamMember" (
    "investigationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEAM_MEMBER',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationTeamMember_pkey" PRIMARY KEY ("investigationId","userId")
);

-- CreateTable
CREATE TABLE "InvestigationFactor" (
    "id" SERIAL NOT NULL,
    "investigationId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationWitness" (
    "id" SERIAL NOT NULL,
    "investigationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "roleOrContact" TEXT,
    "statement" TEXT,
    "interviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationWitness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationTimelineEvent" (
    "id" SERIAL NOT NULL,
    "investigationId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationEvidence" (
    "id" SERIAL NOT NULL,
    "investigationId" INTEGER NOT NULL,
    "attachmentId" INTEGER,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentRelationship" (
    "id" SERIAL NOT NULL,
    "sourceIncidentId" INTEGER NOT NULL,
    "targetIncidentId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationAiFeedback" (
    "id" SERIAL NOT NULL,
    "investigationId" INTEGER NOT NULL,
    "feature" TEXT NOT NULL,
    "resultKey" TEXT NOT NULL,
    "action" "AiFeedbackAction" NOT NULL,
    "reason" TEXT,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationAiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Investigation_incidentId_key" ON "Investigation"("incidentId");

-- CreateIndex
CREATE INDEX "Investigation_leadInvestigatorId_status_idx" ON "Investigation"("leadInvestigatorId", "status");

-- CreateIndex
CREATE INDEX "Investigation_startDate_endDate_idx" ON "Investigation"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "InvestigationTeamMember_userId_idx" ON "InvestigationTeamMember"("userId");

-- CreateIndex
CREATE INDEX "InvestigationFactor_investigationId_idx" ON "InvestigationFactor"("investigationId");

-- CreateIndex
CREATE INDEX "InvestigationWitness_investigationId_idx" ON "InvestigationWitness"("investigationId");

-- CreateIndex
CREATE INDEX "InvestigationTimelineEvent_investigationId_occurredAt_idx" ON "InvestigationTimelineEvent"("investigationId", "occurredAt");

-- CreateIndex
CREATE INDEX "InvestigationEvidence_investigationId_idx" ON "InvestigationEvidence"("investigationId");

-- CreateIndex
CREATE INDEX "IncidentRelationship_targetIncidentId_idx" ON "IncidentRelationship"("targetIncidentId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentRelationship_sourceIncidentId_targetIncidentId_key" ON "IncidentRelationship"("sourceIncidentId", "targetIncidentId");

-- CreateIndex
CREATE INDEX "InvestigationAiFeedback_investigationId_feature_idx" ON "InvestigationAiFeedback"("investigationId", "feature");

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_leadInvestigatorId_fkey" FOREIGN KEY ("leadInvestigatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationTeamMember" ADD CONSTRAINT "InvestigationTeamMember_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationTeamMember" ADD CONSTRAINT "InvestigationTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationFactor" ADD CONSTRAINT "InvestigationFactor_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationWitness" ADD CONSTRAINT "InvestigationWitness_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationTimelineEvent" ADD CONSTRAINT "InvestigationTimelineEvent_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationEvidence" ADD CONSTRAINT "InvestigationEvidence_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentRelationship" ADD CONSTRAINT "IncidentRelationship_sourceIncidentId_fkey" FOREIGN KEY ("sourceIncidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentRelationship" ADD CONSTRAINT "IncidentRelationship_targetIncidentId_fkey" FOREIGN KEY ("targetIncidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationAiFeedback" ADD CONSTRAINT "InvestigationAiFeedback_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
