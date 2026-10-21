// backend/src/shared/constants/taxonomy.constants.ts

/**
 * Constant label used for non-standard or unlisted clinical incident classifications.
 * When selected by staff, a short specific explanation is mandatory.
 */
export const OTHER_OPTION_LABEL = 'Other / Not Listed';

/**
 * Single Source of Truth for Hospital Incident Category & Sub-category Taxonomy.
 * Served directly to Frontend via GET /api/staff/config to avoid duplicate frontend lists.
 */
export const CATEGORY_TAXONOMY: Record<string, string[]> = {
  'MEDICATION & IV FLUIDS': [
    'Wrong Dose / Rate',
    'Wrong Medication',
    'Omission / Missed Dose',
    'Allergic Reaction',
    'High-Alert Infusion Error',
    OTHER_OPTION_LABEL,
  ],
  'CLINICAL / PATIENT CARE': [
    'Diagnosis / Treatment Delay',
    'Procedure Complication',
    'Patient Identification Error',
    'Monitoring Failure',
    OTHER_OPTION_LABEL,
  ],
  'PATIENT SAFETY & FALLS': [
    'Patient Fall',
    'Pressure Injury (Bedsores)',
    'Self-Harm / Elopement',
    'Physical Restraint Event',
    OTHER_OPTION_LABEL,
  ],
  'EQUIPMENT & MEDICAL DEVICES': [
    'Device Failure',
    'Alarm Failure / Silenced',
    'Calibration / Sensor Error',
    'Power / Battery Issue',
    OTHER_OPTION_LABEL,
  ],
  'INFECTION CONTROL': [
    'Contamination / Sterile Breach',
    'Needle Stick Injury',
    'Isolation Protocol Breach',
    'CLABSI',
    'CAUTI',
    OTHER_OPTION_LABEL,
  ],
  'FACILITIES & INFRASTRUCTURE': [
    'Power / Generator Glitch',
    'Medical Gas / Oxygen Failure',
    'Slippery Floor / Spill',
    'Fire / Environmental Hazard',
    OTHER_OPTION_LABEL,
  ],
  'COMMUNICATION & HANDOVER': [
    'Shift Handover Miscommunication',
    'Critical Lab Value Not Relayed',
    'Documentation Error',
    OTHER_OPTION_LABEL,
  ],
  'OTHER / UNLISTED': [
    OTHER_OPTION_LABEL,
  ],
};

/**
 * Incident Temporal Tracking Constants
 * Distinguishes between system submission timestamp and real-world incident occurrence.
 */
export const INCIDENT_TEMPORAL_CONFIG = {
  // Field name capturing the real-world occurrence time
  OCCURRENCE_TIMESTAMP_FIELD: 'occurredAt',
  MAX_RETROACTIVE_DAYS: 30, // Reporting window threshold for historical incidents
};