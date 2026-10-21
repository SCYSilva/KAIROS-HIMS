// backend/src/modules/staff/staff.routes.ts

import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../shared/middleware/auth.middleware';
import { getStaffConfig, saveStaffDraft } from './staff.controller';

const router = Router();

/**
 * GET /api/staff/config
 * Authenticated endpoint: Returns department dropdowns, category taxonomy, and severity definitions.
 */
router.get('/config', authenticate, getStaffConfig);

/**
 * POST /api/staff/draft
 * Authenticated & Role-Gated: Allows staff, managers, investigators, and action owners
 * to save private incident report drafts before final clinical submission.
 */
router.post(
  '/draft',
  authenticate,
  authorizeRoles('STAFF', 'MANAGER', 'INVESTIGATOR', 'ACTION_OWNER'),
  saveStaffDraft
);

export default router;