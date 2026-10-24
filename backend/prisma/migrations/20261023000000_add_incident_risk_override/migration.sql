-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "aiRiskLevelAtOverride" TEXT,
ADD COLUMN     "aiRiskScoreAtOverride" INTEGER,
ADD COLUMN     "riskOverrideLevel" TEXT,
ADD COLUMN     "riskOverrideReason" TEXT,
ADD COLUMN     "riskOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "riskOverriddenById" INTEGER;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_riskOverriddenById_fkey" FOREIGN KEY ("riskOverriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
