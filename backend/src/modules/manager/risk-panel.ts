// backend/src/modules/manager/risk-panel.ts

import {
  isRiskLevel,
  type RiskAssessmentResult,
  type RiskLevel,
} from '../../shared/services/risk-prediction.service';

/**
 * Builds what the "Risk Prediction" card needs: the AI prediction, the manager's override (if any)
 * and the final level. Kept as a pure function (no database, no network) so it is easy to test.
 *
 * Rule: a manager's override always wins. With no override, the AI level is the final level.
 * If the AI is unavailable and there is no override, there is no final level yet.
 */

// The Incident columns this feature reads. Sent to Prisma as `select`, so only these are loaded.
export const RISK_SELECT = {
  id: true,
  title: true,
  description: true,
  severity: true,
  status: true,
  riskOverrideLevel: true,
  riskOverrideReason: true,
  riskOverriddenAt: true,
  aiRiskLevelAtOverride: true,
  aiRiskScoreAtOverride: true,
  riskOverriddenBy: { select: { id: true, name: true } },
  department: { select: { name: true } },
} as const;

export interface RiskOverrideColumns {
  riskOverrideLevel: string | null;
  riskOverrideReason: string | null;
  riskOverriddenAt: Date | null;
  aiRiskLevelAtOverride: string | null;
  aiRiskScoreAtOverride: number | null;
  riskOverriddenBy: { id: number; name: string } | null;
}

export interface RiskOverrideInfo {
  level: RiskLevel;
  reason: string;
  overriddenBy: { id: number; name: string } | null;
  overriddenAt: string | null; // ISO timestamp
  aiLevelAtOverride: RiskLevel | null;
  aiScoreAtOverride: number | null;
}

export interface RiskPanel {
  prediction: RiskAssessmentResult;
  override: RiskOverrideInfo | null;
  finalLevel: RiskLevel | null;
}

export const buildRiskPanel = (
  row: RiskOverrideColumns,
  prediction: RiskAssessmentResult
): RiskPanel => {
  // An unrecognised stored value is ignored rather than shown to a manager
  const override: RiskOverrideInfo | null = isRiskLevel(row.riskOverrideLevel)
    ? {
        level: row.riskOverrideLevel,
        reason: row.riskOverrideReason ?? '',
        overriddenBy: row.riskOverriddenBy
          ? { id: row.riskOverriddenBy.id, name: row.riskOverriddenBy.name }
          : null,
        overriddenAt: row.riskOverriddenAt ? row.riskOverriddenAt.toISOString() : null,
        aiLevelAtOverride: isRiskLevel(row.aiRiskLevelAtOverride) ? row.aiRiskLevelAtOverride : null,
        aiScoreAtOverride: row.aiRiskScoreAtOverride,
      }
    : null;

  let finalLevel: RiskLevel | null = null;
  if (override) {
    finalLevel = override.level;
  } else if (prediction.available) {
    finalLevel = prediction.assessment.riskLevel;
  }

  return { prediction, override, finalLevel };
};
