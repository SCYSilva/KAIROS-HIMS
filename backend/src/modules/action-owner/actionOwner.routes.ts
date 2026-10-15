import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../shared/middleware/auth.middleware';
import upload from '../../shared/middleware/upload.middleware';
import {
  getActionDashboard,
  getActionDetail,
  updateActionProgress,
  resubmitAction,
  uploadActionEvidence,
  viewActionEvidence,
  getActionInsights,
  readNotification,
  managerReviewAction,
} from './actionOwner.controller';

const router = Router();

// Authentication required for all Action Owner endpoints
router.use(authenticate);

// Action Owner core routes
router.get('/dashboard', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), getActionDashboard);
router.patch('/notifications/:id/read', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), readNotification);

router.get('/actions/:id', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), getActionDetail);
router.patch('/actions/:id/progress', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), updateActionProgress);
router.post('/actions/:id/resubmit', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), resubmitAction);

// File Evidence Routes
router.post(
  '/actions/:id/evidence',
  authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'),
  upload.single('evidence'),
  uploadActionEvidence
);
router.get(
  '/actions/:id/evidence/:evidenceId',
  authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'),
  viewActionEvidence
);

// Decision Support Routes
router.get('/actions/:id/insights', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), getActionInsights);
router.get('/actions/:id/ai-insights', authorizeRoles('ACTION_OWNER', 'MANAGER', 'ADMIN'), getActionInsights);

// Manager Review Route (Two-Person Verification Gate)
router.post(
  '/incidents/:id/actions/:actionId/review',
  authorizeRoles('MANAGER', 'ADMIN'),
  managerReviewAction
);

export default router;
