// backend/src/shared/services/risk-prediction.service.ts

import { createHash } from 'crypto';

/**
 * Client for the KAIROS ML service (Predictive Risk Scoring).
 *
 * The ML service is a separate Python process (FastAPI). This module is the ONLY place the
 * backend talks to it. It converts an incident into a scoring request, validates the response
 * and maps it to camelCase for the frontend.
 *
 * Design rules:
 *  - The ML service is OPTIONAL. If it is down, slow or returns something unexpected, this
 *    service never throws. It returns `{ available: false }` so the incident page keeps working.
 *  - The browser never calls the ML service. Only the backend does.
 *  - Successful results are cached briefly (keyed by the incident's scoring inputs), so
 *    reopening a page does not call the ML service again, and editing the title, description
 *    or severity automatically produces a fresh score.
 *
 * Configuration (read at call time, so dotenv has already loaded):
 *  - AI_SERVICE_URL         Base URL of the ML service. Default: http://localhost:8001
 *  - AI_SERVICE_TIMEOUT_MS  Request timeout in milliseconds. Default: 8000
 */

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
type SeverityEnum = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const RISK_LEVELS: readonly RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];

// The ML service expects title-case severity names.
const SEVERITY_TO_ML: Record<SeverityEnum, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export interface RiskScoringInput {
  title: string;
  description: string;
  severity: SeverityEnum;
  department: string;
}

export interface RiskAssessment {
  totalScore: number;
  riskLevel: RiskLevel;
  /** The level from the point total alone, before the reported-severity floor is applied. */
  computedLevelBeforeFloor: RiskLevel;
  /** True when no similar past incidents exist, so the score uses reported severity only. */
  insufficientHistory: boolean;
  breakdown: {
    severity: { value: string; points: number; max: number };
    recurrence: {
      weightedScore: number;
      sameDepartmentMatches: number;
      totalMatches: number;
      points: number;
      max: number;
    } | null;
    duration: { avgResolutionDays: number; points: number; max: number } | null;
  };
}

export type RiskUnavailableReason = 'SERVICE_UNREACHABLE' | 'SERVICE_ERROR' | 'INVALID_RESPONSE';

export type RiskAssessmentResult =
  | { available: true; assessment: RiskAssessment }
  | { available: false; reason: RiskUnavailableReason; message: string };

// ──────────────────────────────────────────────────────────────────────────
// Response validation (the ML service is an external process, so we never trust its shape)
// ──────────────────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isRiskLevel = (value: unknown): value is RiskLevel =>
  typeof value === 'string' && (RISK_LEVELS as readonly string[]).includes(value);

/**
 * Validates the raw JSON from POST /risk-score and maps it to the camelCase RiskAssessment.
 * Returns null if anything required is missing or malformed.
 */
export const parseMlRiskResponse = (raw: unknown): RiskAssessment | null => {
  if (!isRecord(raw)) return null;

  const totalScore = raw.total_score;
  const riskLevel = raw.risk_level;
  const breakdown = raw.breakdown;
  if (!isFiniteNumber(totalScore) || !isRiskLevel(riskLevel) || !isRecord(breakdown)) return null;

  const computedRaw = raw.computed_level_before_floor;
  const computedLevel: RiskLevel = isRiskLevel(computedRaw) ? computedRaw : riskLevel;
  const insufficientHistory = raw.insufficient_history === true;

  // Severity factor (always present)
  const sev = breakdown.severity;
  if (!isRecord(sev)) return null;
  const sevValue = sev.value;
  const sevPoints = sev.points;
  const sevMax = sev.max;
  if (typeof sevValue !== 'string' || !isFiniteNumber(sevPoints) || !isFiniteNumber(sevMax)) {
    return null;
  }

  // Recurrence factor: absent (just a "note") when there is no history
  const rec = breakdown.recurrence;
  let recurrence: RiskAssessment['breakdown']['recurrence'] = null;
  if (!insufficientHistory && isRecord(rec)) {
    const points = rec.points;
    const max = rec.max;
    if (isFiniteNumber(points) && isFiniteNumber(max)) {
      const weighted = rec.weighted_score;
      const sameDept = rec.same_department_matches_raw_count;
      const total = rec.total_matches_all_departments;
      recurrence = {
        weightedScore: isFiniteNumber(weighted) ? weighted : 0,
        sameDepartmentMatches: isFiniteNumber(sameDept) ? sameDept : 0,
        totalMatches: isFiniteNumber(total) ? total : 0,
        points,
        max,
      };
    }
  }

  // Duration factor: absent (just a "note") when there is no history
  const dur = breakdown.duration;
  let duration: RiskAssessment['breakdown']['duration'] = null;
  if (!insufficientHistory && isRecord(dur)) {
    const points = dur.points;
    const max = dur.max;
    if (isFiniteNumber(points) && isFiniteNumber(max)) {
      const avgDays = dur.avg_resolution_days;
      duration = {
        avgResolutionDays: isFiniteNumber(avgDays) ? avgDays : 0,
        points,
        max,
      };
    }
  }

  return {
    totalScore,
    riskLevel,
    computedLevelBeforeFloor: computedLevel,
    insufficientHistory,
    breakdown: {
      severity: { value: sevValue, points: sevPoints, max: sevMax },
      recurrence,
      duration,
    },
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Short-lived result cache
// ──────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  assessment: RiskAssessment;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();

const buildCacheKey = (incidentId: number, input: RiskScoringInput): string => {
  const fingerprint = createHash('sha1')
    .update(JSON.stringify([input.title, input.description, input.severity, input.department]))
    .digest('hex');
  return `${incidentId}:${fingerprint}`;
};

const unavailable = (reason: RiskUnavailableReason, message: string): RiskAssessmentResult => ({
  available: false,
  reason,
  message,
});

// ──────────────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────────────

export class RiskPredictionService {
  private getBaseUrl(): string {
    return (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/+$/, '');
  }

  private getTimeoutMs(): number {
    const parsed = Number(process.env.AI_SERVICE_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
  }

  /**
   * Scores one incident. Never throws: any ML-service problem is returned as
   * `{ available: false, reason, message }`.
   */
  async scoreIncident(incidentId: number, input: RiskScoringInput): Promise<RiskAssessmentResult> {
    const key = buildCacheKey(incidentId, input);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return { available: true, assessment: hit.assessment };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.getTimeoutMs());

    try {
      const response = await fetch(`${this.getBaseUrl()}/risk-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          severity: SEVERITY_TO_ML[input.severity],
          department: input.department,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[risk-prediction] ML service responded with HTTP ${response.status}`);
        return unavailable(
          'SERVICE_ERROR',
          `The risk prediction service returned an error (HTTP ${response.status}).`
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return unavailable('INVALID_RESPONSE', 'The risk prediction service returned an unreadable response.');
      }

      const assessment = parseMlRiskResponse(payload);
      if (!assessment) {
        console.warn('[risk-prediction] ML service response did not match the expected shape');
        return unavailable('INVALID_RESPONSE', 'The risk prediction service returned an unexpected response.');
      }

      if (cache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) cache.delete(oldestKey);
      }
      cache.set(key, { assessment, expiresAt: Date.now() + CACHE_TTL_MS });

      return { available: true, assessment };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[risk-prediction] ML service unreachable: ${detail}`);
      return unavailable('SERVICE_UNREACHABLE', 'The risk prediction service could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  }
}

export const riskPredictionService = new RiskPredictionService();
