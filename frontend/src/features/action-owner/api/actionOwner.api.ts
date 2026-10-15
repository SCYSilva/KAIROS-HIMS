import { apiClient } from '../../../shared/api/axios';

export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ActionReviewStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED_PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'RETURNED_FOR_REVISION';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActionType = 'CORRECTIVE' | 'PREVENTIVE' | string;

export interface ActionNotification {
  id: number;
  actionItemId: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
}

export interface ActionEvidence {
  id: number;
  actionItemId?: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
}

export interface ActionHistory {
  id: number;
  actionItemId?: number;
  actorId?: number | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  notes?: string | null;
  createdAt: string;
  actor?: {
    id: number;
    name: string;
    role: string;
  } | null;
}

export interface CompletionRisk {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
  modelVersion: string;
}

export interface ActionIncident {
  id: number;
  referenceId?: string;
  title: string;
  severity?: string;
  category?: string;
  status?: string;
  location?: string;
  department: { id: number; name: string };
  reporter?: { id: number; name: string };
  investigator?: { id: number; name: string; email?: string };
}

export interface ActionItem {
  id: number;
  incidentId: number;
  ownerId: number;
  title: string;
  description: string;
  type: ActionType;
  priority: Priority;
  status: ActionStatus;
  reviewStatus: ActionReviewStatus;
  dueDate: string;
  dueInDays: number;
  overdue: boolean;
  progressNote?: string | null;
  verificationNotes?: string | null;
  managerReviewComment?: string | null;
  completedAt?: string | null;
  effectiveness?: string | null;
  effectivenessScore?: number | null;
  completionRisk: CompletionRisk;
  incident: ActionIncident;
  evidence: ActionEvidence[];
  history: ActionHistory[];
}

export interface ActionDashboardSummary {
  total: number;
  open: number;
  inProgress: number;
  overdue: number;
  revisions: number;
  pendingVerification: number;
  verified: number;
}

export interface ActionDashboardData {
  summary: ActionDashboardSummary;
  items: ActionItem[];
  notifications: ActionNotification[];
}

export interface ActionInsights {
  modelVersion: string;
  completionRisk: CompletionRisk;
  similarActions: Array<{
    id: number;
    title: string;
    description: string;
    status: ActionStatus;
    reviewStatus: ActionReviewStatus;
    similarityScore: number;
    effectiveness?: string | null;
    effectivenessScore?: number | null;
    incident: {
      id: number;
      title: string;
      category: string;
      department?: { id: number; name: string };
    };
  }>;
  recommendations: Array<{
    key: string;
    title: string;
    description: string;
    effectiveness: string;
    effectivenessScore: number;
    sourceIncident: {
      id: number;
      title: string;
    };
  }>;
}

const unwrap = <T>(response: { data: { data: T } }): T => response.data.data;

export const actionOwnerApi = {
  dashboard: async (params?: Record<string, string>): Promise<ActionDashboardData> =>
    unwrap<ActionDashboardData>(await apiClient.get('/action-owner/dashboard', { params })),
  readNotification: async (id: number): Promise<unknown> =>
    unwrap(await apiClient.patch(`/action-owner/notifications/${id}/read`)),
  detail: async (id: number): Promise<ActionItem> =>
    unwrap<ActionItem>(await apiClient.get(`/action-owner/actions/${id}`)),
  insights: async (id: number): Promise<ActionInsights> =>
    unwrap<ActionInsights>(await apiClient.get(`/action-owner/actions/${id}/insights`)),
  progress: async (
    id: number,
    payload: { status: ActionStatus; progressNote: string; verificationNotes?: string }
  ): Promise<ActionItem> =>
    unwrap<ActionItem>(await apiClient.patch(`/action-owner/actions/${id}/progress`, payload)),
  resubmit: async (
    id: number,
    payload: { progressNote: string; verificationNotes: string }
  ): Promise<ActionItem> =>
    unwrap<ActionItem>(await apiClient.post(`/action-owner/actions/${id}/resubmit`, payload)),
  uploadEvidence: async (id: number, file: File): Promise<ActionEvidence> => {
    const formData = new FormData();
    formData.append('evidence', file);
    const res = await apiClient.post(`/action-owner/actions/${id}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  viewEvidence: async (id: number, evidenceId: number): Promise<Blob> => {
    const res = await apiClient.get<Blob>(`/action-owner/actions/${id}/evidence/${evidenceId}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
