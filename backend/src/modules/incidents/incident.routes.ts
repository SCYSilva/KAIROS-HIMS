// backend/src/modules/incidents/incident.routes.ts

import { Router } from "express";
import {
  createIncident,
  getDepartmentIncidents,
  getIncidentById,
  getMyIncidents,
} from './incident.controller';

import upload from '../../shared/middleware/upload.middleware';
import { authenticate, authorizeRoles } from '../../shared/middleware/auth.middleware';

const router = Router();

// ==========================================
// CORE INCIDENT ENTITY ROUTES ONLY
// Role-specific governance workflows live in:
//   manager/        → Triage, Assignment, Review, Close
//   investigations/ → Root Cause Analysis, Timeline, Evidence
//   action-owner/   → CAPA Action items, Proof documents
// ==========================================

/**
 * POST /api/incidents
 * Staff submits a new incident report with up to 5 evidence attachments.
 */
router.post(
  "/",
  authenticate,
  authorizeRoles("STAFF"),
  upload.array("evidence", 5),
  createIncident
);

/**
 * GET /api/incidents/my & GET /api/incidents/my-incidents
 * Staff views their own submitted incident history with status metrics.
 */
router.get("/my", authenticate, getMyIncidents);
router.get("/my-incidents", authenticate, getMyIncidents);

/**
 * GET /api/incidents/department/:departmentId
 * Manager and staff view all incidents for a specific hospital department.
 */
router.get(
  '/department/:departmentId',
  authenticate,
  authorizeRoles('MANAGER', 'STAFF'),
  getDepartmentIncidents
);

/**
 * GET /api/incidents/:id
 * Authenticated users view full clinical incident record.
 * NOTE: Registered LAST so it does not shadow /my or /department routes.
 */
router.get("/:id", authenticate, getIncidentById);

export default router;