/**
 * Staff Types & Interfaces
 *
 * Domain contracts specific to the Hospital Staff reporting workspace:
 * - AI Compliance and policy validation results
 * - Clinical form configuration datasets
 * - Staff incident list items and submission summaries
 */

import type { Department, IncidentStatus } from '../../incidents/types/incident';

export interface ComplianceCheckItem {
  id: string;
  label: string;
  passed: boolean;
  tip?: string;
}

export interface StaffAssistResult {
  completenessScore: number;
  completenessLevel: string;
  suggestedCategory: string;
  suggestedSubCategory: string;
  suggestedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  similarIncidentsCount: number;
  similaritySummary: string;
  complianceChecks: ComplianceCheckItem[];
}

export interface StaffConfigData {
  departments: Department[];
  categories: Record<string, string[]>;
  severities: string[];
}

export interface StaffIncidentItem {
  id: number;
  referenceId: string;
  title: string;
  category: string;
  subcategory?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  status: IncidentStatus;
  reportedAt: string;
  location: string;
  department?: {
    id?: number;
    name: string;
  };
  rejectionReason?: string;
  description?: string;
}

export interface StaffIncidentsSummary {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
}

export interface StaffIncidentsResponseData {
  summary: StaffIncidentsSummary;
  items: StaffIncidentItem[];
}
