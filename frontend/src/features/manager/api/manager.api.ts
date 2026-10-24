// frontend/src/features/manager/api/manager.api.ts

import { apiClient } from '../../../shared/api/axios';

// ==========================================
// 1. DOMAIN ENUMS & BASE TYPES
// ==========================================

export type IncidentStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'INVESTIGATING'
  | 'PENDING_ACTION'
  | 'UNDER_REVIEW'
  | 'CLOSED';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CapaType = 'CORRECTIVE' | 'PREVENTIVE';
export type CapaPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CapaStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ControlEffectiveness = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
export type ControlStatus = 'PLANNED' | 'IN_PROGRESS' | 'VERIFIED';
export type ReviewOutcome = 'APPROVED' | 'REVISION_REQUIRED';

export interface DepartmentUser {
  id: number;
  name: string;
  email: string;
  role: 'STAFF' | 'INVESTIGATOR' | 'ACTION_OWNER' | 'MANAGER' | 'ADMIN';
}

export interface IncidentAttachment {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
  uploadedAt: string;
}

// ==========================================
// 2. CLINICAL GOVERNANCE ENTITIES
// ==========================================

export interface CapaAction {
  id: number;
  incidentId: number;
  title: string;
  actionType: CapaType;
  priority: CapaPriority;
  dueDate: string;
  actionOwnerId: number;
  actionOwner: DepartmentUser;
  description: string;
  status: CapaStatus;
  evidenceNotes?: string;
  isVerified: boolean;
  verifiedAt?: string;
  verifiedBy?: { id: number; name: string };
  verificationNotes?: string;
  createdAt: string;
}

export interface IncidentControl {
  id: number;
  incidentId: number;
  controlType: string;
  effectiveness: ControlEffectiveness;
  status: ControlStatus;
  failureReason?: string;
  requiredImprovement?: string;
  targetDate: string;
  createdAt: string;
}

export interface ManagementReview {
  id: number;
  incidentId: number;
  outcome: ReviewOutcome;
  lessonsLearned: string;
  outcomeComments: string;
  followUpMonitoring: string;
  reviewedById: number;
  reviewedBy: { id: number; name: string };
  reviewedAt: string;
}

export interface LessonsDissemination {
  id: number;
  incidentId: number;
  audience: string;
  scheduledDate: string;
  status: 'SCHEDULED' | 'COMPLETED';
}

export interface IncidentAuditLog {
  id: number;
  incidentId: number;
  userId: number;
  user: { id: number; name: string; role: string };
  action: string;
  reason?: string;
  changes?: string;
  createdAt: string;
}

export interface ManagerIncidentDetail {
  id: number;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  location: string;
  status: IncidentStatus;
  rejectionReason?: string;
  rootCause?: string;
  rootCauseCategory?: string;
  investigationFindings?: string;
  investigationReviewStatus?: 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED';
  investigationReviewComment?: string;
  departmentId: number;
  department: { id: number; name: string };
  reporterId: number;
  reporter: DepartmentUser;
  investigatorId?: number;
  investigator?: DepartmentUser;
  actionOwnerId?: number;
  actionOwner?: DepartmentUser;
  closedAt?: string;
  closureSummary?: string;
  closedById?: number;
  closedBy?: { id: number; name: string };
  attachments: IncidentAttachment[];
  capaActions: CapaAction[];
  controls: IncidentControl[];
  managementReview?: ManagementReview;
  disseminations: LessonsDissemination[];
  auditLogs: IncidentAuditLog[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. MUTATION PAYLOAD CONTRACTS
// ==========================================

export interface TriagePayload {
  decision: 'ACCEPT' | 'REVISE' | 'REJECT';
  rationale: string;
}

export interface RecordCorrectionPayload {
  title?: string;
  severity?: Severity;
  category?: string;
  location?: string;
  auditReason: string;
}

export interface AssignInvestigatorPayload {
  investigatorId: number;
}

export interface ReviewInvestigationPayload {
  decision: 'APPROVE' | 'REVISE';
  comments: string;
}

export interface CreateCapaPayload {
  title: string;
  actionType: CapaType;
  priority: CapaPriority;
  dueDate: string;
  actionOwnerId: number;
  description: string;
}

export interface VerifyCapaPayload {
  decision: 'VERIFY' | 'REVISE';
  notes?: string;
}

export interface CreateControlPayload {
  controlType: string;
  effectiveness: ControlEffectiveness;
  status: ControlStatus;
  failureReason?: string;
  requiredImprovement?: string;
  targetDate: string;
}

export interface ManagementReviewPayload {
  outcome: ReviewOutcome;
  lessonsLearned: string;
  outcomeComments: string;
  followUpMonitoring: string;
  dissemination?: {
    audience: string;
    scheduledDate: string;
    status: 'SCHEDULED' | 'COMPLETED';
  };
}

export interface CloseIncidentPayload {
  closureSummary: string;
}

// ==========================================
// 4. COMMAND CENTRE & ANALYTICS DATA MODELS
// ==========================================

// Top-level Decision Counters (Tier 1 KPI Row)
export interface ManagerCommandCentreKPIs {
  awaitingDecisionCount: number;    // Status = OPEN (Needs Triage)
  unassignedCount: number;          // Status = ACCEPTED & investigatorId == null
  findingsToApproveCount: number;   // Status = INVESTIGATING & reviewStatus == PENDING
  awaitingVerificationCount: number;// CapaAction status = COMPLETED & isVerified == false
  overdueActionsCount: number;      // CapaAction dueDate < today & status != COMPLETED
  highRiskOpenCount: number;        // Severity in [HIGH, CRITICAL] & status != CLOSED
}

// Urgent Feed Queue Item (Tier 2 Left Column)
export interface AttentionQueueItem {
  id: number;
  incidentId: number;
  title: string;
  type: 'ACTION_OVERDUE' | 'TRIAGE_PENDING' | 'FINDINGS_REVIEW' | 'VERIFICATION_PENDING';
  severity: Severity;
  priority?: CapaPriority;
  assigneeName?: string;
  daysOverdue?: number;
  dueDate?: string;
}

// Department Health & Operational Benchmarks (Tier 2 Right Column)
export interface DepartmentHealthMetrics {
  closureRatePercentage: number;     // (Closed incidents / Total incidents) * 100
  actionCompletionPercentage: number;// (Completed CAPAs / Total CAPAs) * 100
  slaCompliancePercentage: number;   // Incidents processed within SLA guidelines
  openIncidentsCount: number;        // Total ongoing incidents
  oldestOpenIncidentDays: number;    // Days since oldest open incident was logged
}

// Overdue Actions Workbench Card (Tier 3 Grid)
export interface OverdueActionWorkbenchItem {
  actionId: number;
  incidentId: number;
  incidentTitle: string;
  actionTitle: string;
  assignedOwnerName: string;
  assignedOwnerEmail: string;
  severity: Severity;
  priority: CapaPriority;
  dueDate: string;
  daysOverdue: number;
}

// Complete Aggregated Dashboard Response
export interface ManagerDashboardData {
  kpis: ManagerCommandCentreKPIs;
  attentionItems: AttentionQueueItem[];
  departmentHealth: DepartmentHealthMetrics;
  overdueActions: OverdueActionWorkbenchItem[];
}

// Analytical Views Model (/analytics)
export interface ManagerAnalyticsSummary {
  totalIncidents: number;
  openTriage: number;
  criticalSeverity: number;
  closedResolved: number;
  avgResolutionDays: number;
}

export interface WorkflowStageItem {
  stage: IncidentStatus;
  count: number;
}

export interface SeverityProfileItem {
  severity: Severity;
  count: number;
}

export interface TopCategoryItem {
  category: string;
  count: number;
}

export interface ManagerAnalyticsData {
  summary: ManagerAnalyticsSummary;
  workflowStages: WorkflowStageItem[];
  severityProfile: SeverityProfileItem[];
  topCategories: TopCategoryItem[];
}

export interface DepartmentTeamResponse {
  counts: {
    total: number;
    investigators: number;
    actionOwners: number;
    generalStaff: number;
  };
  users: (DepartmentUser & {
    createdAt: string;
    _count?: {
      investigatedIncidents: number;
      assignedCapaActions: number;
    };
  })[];
}

// ==========================================
// 4b. AI RISK ASSESSMENT (ML service)
// ==========================================

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface IncidentRiskAssessment {
  totalScore: number; // 0-100
  riskLevel: RiskLevel;
  /** Level from the point total alone, before the reported-severity floor was applied */
  computedLevelBeforeFloor: RiskLevel;
  /** True when no similar past incidents exist, so the score uses reported severity only */
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

// The backend never fails the request when the ML service is down: it returns available: false
export type IncidentRiskResult =
  | { available: true; assessment: IncidentRiskAssessment }
  | {
      available: false;
      reason: 'SERVICE_UNREACHABLE' | 'SERVICE_ERROR' | 'INVALID_RESPONSE';
      message: string;
    };

// A manager's human override of the AI prediction
export interface RiskOverride {
  level: RiskLevel;
  reason: string;
  overriddenBy: { id: number; name: string } | null;
  overriddenAt: string | null; // ISO timestamp
  aiLevelAtOverride: RiskLevel | null;
  aiScoreAtOverride: number | null;
}

// Everything the Risk Prediction card needs. finalLevel = the override if there is one,
// otherwise the AI level, otherwise null (AI offline and nothing set yet).
export interface IncidentRiskPanel {
  prediction: IncidentRiskResult;
  override: RiskOverride | null;
  finalLevel: RiskLevel | null;
}

// ==========================================
// 5. REST CLIENT API CALLS
// ==========================================

export const managerApi = {
  // Fetch Command Centre Dashboard Data
  getDashboardData: async (): Promise<ManagerDashboardData> => {
    const response = await apiClient.get<{ success: boolean; data: ManagerDashboardData }>(
      '/manager/dashboard'
    );
    return response.data.data;
  },

  // Fetch Incident Details with Relations
  getIncidentDetails: async (id: number): Promise<ManagerIncidentDetail> => {
    const response = await apiClient.get<{ success: boolean; data: ManagerIncidentDetail }>(
      `/manager/incidents/${id}`
    );
    return response.data.data;
  },

  // Fetch the Risk Prediction card data (AI prediction + manager override)
  getIncidentRiskAssessment: async (id: number): Promise<IncidentRiskPanel> => {
    const response = await apiClient.get<{ success: boolean; data: IncidentRiskPanel }>(
      `/manager/incidents/${id}/risk-assessment`
    );
    return response.data.data;
  },

  // Human override: manager sets the risk level themselves (reason is mandatory)
  setIncidentRiskOverride: async (
    id: number,
    payload: { level: RiskLevel; reason: string }
  ): Promise<IncidentRiskPanel> => {
    const response = await apiClient.put<{ success: boolean; data: IncidentRiskPanel }>(
      `/manager/incidents/${id}/risk-override`,
      payload
    );
    return response.data.data;
  },

  // Remove the override so the AI prediction is the final level again
  clearIncidentRiskOverride: async (id: number): Promise<IncidentRiskPanel> => {
    const response = await apiClient.delete<{ success: boolean; data: IncidentRiskPanel }>(
      `/manager/incidents/${id}/risk-override`
    );
    return response.data.data;
  },

  // Fetch Department Personnel Roster
  getDepartmentTeam: async (): Promise<{ counts: any; users: DepartmentUser[] }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: { counts: any; users: DepartmentUser[] };
    }>('/manager/team');
    return response.data.data;
  },

  // Delegate Role to Team Member
  updateTeamRole: async (userId: number, role: 'STAFF' | 'INVESTIGATOR' | 'ACTION_OWNER') => {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      data: DepartmentUser;
    }>(`/manager/team/${userId}/role`, { role });
    return response.data;
  },

  // Fetch Analytics & Trends
  getAnalytics: async (): Promise<ManagerAnalyticsData> => {
    const response = await apiClient.get<{ success: boolean; data: ManagerAnalyticsData }>(
      '/manager/analytics'
    );
    return response.data.data;
  },

  // Stage 1: Triage Action
  triageIncident: async (id: number, payload: TriagePayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/triage`, payload);
    return response.data;
  },

  // Stage 1: Audited Record Correction
  correctRecord: async (id: number, payload: RecordCorrectionPayload) => {
    const response = await apiClient.patch(`/manager/incidents/${id}/correction`, payload);
    return response.data;
  },

  // Stage 2: Assign Investigator
  assignInvestigator: async (id: number, payload: AssignInvestigatorPayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/investigator`, payload);
    return response.data;
  },

  // Stage 2: Review Findings
  reviewInvestigation: async (id: number, payload: ReviewInvestigationPayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/review-investigation`, payload);
    return response.data;
  },

  // Stage 3: Create CAPA Action
  createCapaAction: async (id: number, payload: CreateCapaPayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/actions`, payload);
    return response.data;
  },

  // Stage 3: Verify CAPA Action Completion
  verifyCapaAction: async (id: number, actionId: number, payload: VerifyCapaPayload) => {
    const response = await apiClient.post(
      `/manager/incidents/${id}/actions/${actionId}/verify`,
      payload
    );
    return response.data;
  },

  // Stage 3: Add Departmental Control
  createControl: async (id: number, payload: CreateControlPayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/controls`, payload);
    return response.data;
  },

  // Stage 4: Submit Management Review
  submitReview: async (id: number, payload: ManagementReviewPayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/review`, payload);
    return response.data;
  },

  // Stage 4: Controlled Final Closure Gate
  closeIncident: async (id: number, payload: CloseIncidentPayload) => {
    const response = await apiClient.post(`/manager/incidents/${id}/close`, payload);
    return response.data;
  },
};