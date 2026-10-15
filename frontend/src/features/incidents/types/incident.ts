/**
 * Core Clinical Incident Domain Types
 *
 * Single source of truth for the primary Incident entity across all roles in KAIROS HIMS:
 * - IncidentStatus: Enum mirroring Prisma IncidentStatus
 * - Incident: Complete clinical incident record schema
 * - User: Essential user model representation
 * - Department: Hospital department reference model
 * - IncidentAttachment: Secure file attachment metadata
 * - ApiResponse: Generic typed HTTP response envelope
 */

// 1. Possible status values matching Backend Prisma Enum
export type IncidentStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'INVESTIGATING'
  | 'PENDING_ACTION'
  | 'UNDER_REVIEW'
  | 'CLOSED';

// 2. User model for clinical roles (reporter, investigator, action owner, verifier)
export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  departmentId?: number;
}

// 3. Hospital Department model
export interface Department {
  id: number;
  name: string;
}

// 4. Clinical Evidence & Attachment metadata
export interface IncidentAttachment {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
}

// 5. Main Incident interface matching Backend response
export interface Incident {
  id: number;
  title: string;
  description: string;

  severity: string;
  category: string;
  location: string;

  status: IncidentStatus;

  rejectionReason?: string;

  rootCause?: string;
  rootCauseCategory?: string;
  investigationFindings?: string;
  investigationReviewStatus?: string;
  investigationReviewComment?: string;
  correctiveAction?: string;

  departmentId: number;
  reporterId: number;
  investigatorId?: number;
  actionOwnerId?: number;

  createdAt: string;
  updatedAt: string;

  reporter?: User;
  investigator?: User;
  actionOwner?: User;

  department?: Department;
  attachments?: IncidentAttachment[];
}

// 6. Generic API Response envelope matching Backend standards
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
