import { apiClient } from '../../../shared/api/axios';
import type { Incident, User } from '../../incidents/types/incident';

export type InvestigationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED';
export type InvestigationMethod =
  | 'FIVE_WHYS'
  | 'FISHBONE'
  | 'FAULT_TREE'
  | 'TIMELINE_ANALYSIS'
  | 'OTHER';

export interface InvestigationTeamMember {
  userId: number;
  role: string;
  user: User;
}

export interface InvestigationFactor {
  id?: number;
  category: string;
  description: string;
}

export interface InvestigationWitness {
  id?: number;
  name: string;
  roleOrContact?: string | null;
  statement?: string | null;
  interviewedAt?: string | null;
}

export interface InvestigationTimelineEvent {
  id?: number;
  occurredAt: string;
  title: string;
  description: string;
  source?: string | null;
}

export interface InvestigationEvidence {
  id?: number;
  attachmentId?: number | null;
  label: string;
  reference?: string | null;
  notes?: string | null;
}

export interface InvestigationRecord {
  id: number;
  incidentId: number;
  leadInvestigatorId: number;
  status: InvestigationStatus;
  startDate?: string | null;
  endDate?: string | null;
  method?: InvestigationMethod | null;
  methodOther?: string | null;
  findingsSummary?: string | null;
  rootCauseCategory?: string | null;
  rootCauseSubcategory?: string | null;
  rootCauseDescription?: string | null;
  rootCauseMethod?: InvestigationMethod | null;
  rootCauseDetail?: string | null;
  systemicIssue: boolean;
  revisionNumber: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  lockedAt?: string | null;
  incident: Incident;
  leadInvestigator: User;
  teamMembers: InvestigationTeamMember[];
  contributingFactors: InvestigationFactor[];
  witnesses: InvestigationWitness[];
  timeline: InvestigationTimelineEvent[];
  evidence: InvestigationEvidence[];
}

export interface InvestigationDashboardItem extends InvestigationRecord {
  priority: number;
  overdue: boolean;
  _count: {
    teamMembers: number;
    evidence: number;
    timeline: number;
    contributingFactors: number;
  };
}

export interface InvestigationDashboard {
  summary: {
    total: number;
    drafts: number;
    revision: number;
    submitted: number;
    overdue: number;
  };
  items: InvestigationDashboardItem[];
}

export interface DecisionSupportData {
  modelVersion: string;
  disclaimer: string;
  similarIncidents: Array<{
    id: number;
    title: string;
    category: string;
    location: string;
    severity: string;
    rootCauseCategory?: string;
    rootCause?: string;
    matchedFields: string[];
    similarity: number;
  }>;
  clusters: Array<{ name: string; count: number; incidentIds: number[] }>;
  methodSuggestions: Array<{ method: InvestigationMethod; reason: string }>;
  summaries: { timeline: string; evidence: string };
}

const unwrap = <T>(response: { data: { data: T } }): T => response.data.data;

export const investigationApi = {
  dashboard: async (params?: Record<string, string>) =>
    unwrap<InvestigationDashboard>(await apiClient.get('/investigations/dashboard', { params })),
  workspace: async (id: number) =>
    unwrap<InvestigationRecord>(await apiClient.get(`/investigations/${id}`)),
  candidates: async (id: number) =>
    unwrap<User[]>(await apiClient.get(`/investigations/${id}/candidates`)),
  saveDraft: (id: number, body: unknown) =>
    apiClient.put(`/investigations/${id}/draft`, body),
  addTeam: (id: number, body: { userId: number; role: string }) =>
    apiClient.post(`/investigations/${id}/team`, body),
  removeTeam: (id: number, userId: number) =>
    apiClient.delete(`/investigations/${id}/team/${userId}`),
  addWitness: (
    id: number,
    body: { name: string; roleOrContact?: string; statement?: string; interviewedAt?: string }
  ) => apiClient.post(`/investigations/${id}/witnesses`, body),
  addTimeline: (
    id: number,
    body: { occurredAt: string; title: string; description: string; source?: string }
  ) => apiClient.post(`/investigations/${id}/timeline`, body),
  addEvidence: (
    id: number,
    body: { attachmentId?: number; label: string; reference?: string; notes?: string }
  ) => apiClient.post(`/investigations/${id}/evidence`, body),
  linkIncident: (id: number, body: { targetIncidentId: number; reason: string }) =>
    apiClient.post(`/investigations/${id}/links`, body),
  submit: (id: number) => apiClient.post(`/investigations/${id}/submit`),
  decisionSupport: async (id: number) =>
    unwrap<DecisionSupportData>(await apiClient.get(`/investigations/${id}/decision-support`)),
  feedback: (id: number, body: unknown) =>
    apiClient.post(`/investigations/${id}/ai-feedback`, body),
};
