import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../shared/middleware/auth.middleware';
import {
  addEvidence,
  addTeamMember,
  addTimeline,
  addWitness,
  getCandidates,
  getDashboard,
  getDecisionSupport,
  getWorkspace,
  linkIncident,
  recordAiFeedback,
  removeTeamMember,
  saveDraft,
  submitInvestigation,
  submitRootCause,
} from './investigation.controller';

const router = Router();

// Enforce authentication & investigator/admin authorization
router.use(authenticate, authorizeRoles('INVESTIGATOR', 'ADMIN'));

// Core investigation workspace & console endpoints
router.get('/dashboard', getDashboard);
router.get('/:id/candidates', getCandidates);
router.get('/:id/ai-insights', getDecisionSupport);
router.get('/:id/decision-support', getDecisionSupport);
router.post('/:id/ai-feedback', recordAiFeedback);

router.get('/:id', getWorkspace);
router.put('/:id/draft', saveDraft);

// Sub-entity governance routes
router.post('/:id/team', addTeamMember);
router.delete('/:id/team/:userId', removeTeamMember);
router.post('/:id/witnesses', addWitness);
router.post('/:id/timeline', addTimeline);
router.post('/:id/evidence', addEvidence);
router.post('/:id/links', linkIncident);

// Final submission gate
router.post('/:id/submit', submitInvestigation);

// Compatibility with legacy root-cause endpoint
router.patch('/:id/root-cause', submitRootCause);

export default router;
