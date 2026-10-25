// backend/src/modules/manager/manager.routes.ts

import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../shared/middleware/auth.middleware';
import {
  getManagerDashboard,
  getManagerAnalytics,
  getDepartmentTeam,
  updateTeamRole,
  getManagerIncidentDetails,
  getIncidentRiskAssessment,
  setIncidentRiskOverride,
  clearIncidentRiskOverride,
  searchLessons,
  triageIncident,
  correctIncidentRecord,
  assignInvestigator,
  reviewInvestigation,
  createCapaAction,
  verifyCapaAction,
  createControl,
  submitManagementReview,
  closeIncident,
} from './manager.controller';

const router = Router();

// Enforce authentication & manager authorization on all routes
router.use(authenticate);
router.use(authorizeRoles('MANAGER', 'ADMIN'));

// Core Department Views
router.get('/dashboard', getManagerDashboard);
router.get('/analytics', getManagerAnalytics);
router.get('/team', getDepartmentTeam);
router.patch('/team/:userId/role', updateTeamRole);

// Incident Details & 4-Stage Governance Workflow
router.get('/incidents/:id', getManagerIncidentDetails);
router.get('/incidents/:id/risk-assessment', getIncidentRiskAssessment);
router.put('/incidents/:id/risk-override', setIncidentRiskOverride);
router.delete('/incidents/:id/risk-override', clearIncidentRiskOverride);

// Lessons Learned library (search across the organisation)
router.get('/lessons/search', searchLessons);
router.post('/incidents/:id/triage', triageIncident);
router.patch('/incidents/:id/correction', correctIncidentRecord);
router.post('/incidents/:id/investigator', assignInvestigator);
router.post('/incidents/:id/review-investigation', reviewInvestigation);
router.post('/incidents/:id/actions', createCapaAction);
router.post('/incidents/:id/actions/:actionId/verify', verifyCapaAction);
router.post('/incidents/:id/controls', createControl);
router.post('/incidents/:id/review', submitManagementReview);
router.post('/incidents/:id/close', closeIncident);

export default router;