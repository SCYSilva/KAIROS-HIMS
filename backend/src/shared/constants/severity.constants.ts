// backend/src/shared/constants/severity.constants.ts

/**
 * Hospital Clinical Incident Severity Levels
 * Aligns with international clinical risk matrices and healthcare governance benchmarks.
 */
export const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

/**
 * Clinical descriptions and response SLA guidelines for each severity tier
 */
export const SEVERITY_METADATA: Record<SeverityLevel, { label: string; slaHours: number; description: string }> = {
  LOW: {
    label: 'Low Severity',
    slaHours: 72,
    description: 'Minor incident, near miss, or no harm caused to the patient.',
  },
  MEDIUM: {
    label: 'Medium Severity',
    slaHours: 48,
    description: 'Moderate harm requiring non-permanent clinical intervention or monitoring.',
  },
  HIGH: {
    label: 'High Severity',
    slaHours: 24,
    description: 'Severe harm or significant clinical deterioration requiring urgent escalation.',
  },
  CRITICAL: {
    label: 'Critical / Sentinel Event',
    slaHours: 12,
    description: 'Sentinel event involving permanent disability, code blue, ICU transfer, or fatality.',
  },
};