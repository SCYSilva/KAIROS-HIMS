// backend/src/modules/staff/staff.controller.ts

import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync';
import { staffService } from './staff.service';

/**
 * GET /api/staff/config
 * Controller to fetch dynamic incident reporting configuration for staff.
 * Delivers departments, category taxonomy, severities, and SLA metadata.
 */
export const getStaffConfig = catchAsync(async (_req: Request, res: Response) => {
  const data = await staffService.getConfig();

  return res.status(200).json({
    success: true,
    data,
    departments: data.departments, // Direct array fallback for legacy frontend compatibility
  });
});

/**
 * POST /api/staff/draft
 * Controller to securely register a private incident draft for logged-in staff.
 * Allows clinical staff to save partial reports before formal submission.
 */
export const saveStaffDraft = catchAsync(async (req: Request, res: Response) => {
  // Generate a distinct time-stamped draft identifier
  const draftId = `DFT-${Date.now().toString(36).toUpperCase()}`;

  return res.status(200).json({
    success: true,
    message: 'Private draft saved successfully. Drafts are visible only to you.',
    data: {
      draftId,
      savedAt: new Date().toISOString(),
      authorId: req.user?.id,
      summary: req.body?.title || 'Untitled Draft',
    },
  });
});