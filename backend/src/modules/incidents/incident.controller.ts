// backend/src/modules/incidents/incident.controller.ts

import { Request, Response } from 'express';
import {
  incidentSchema,
  departmentParamsSchema,
} from './incident.validator';
import { incidentService } from './incident.service';
import { catchAsync } from '../../shared/utils/catchAsync';
import { AppError } from '../../shared/utils/AppError';

/**
 * POST /api/incidents
 * Controller for creating a new incident report with file attachments.
 * Security: Overrides reporterId with the verified JWT user ID.
 */
export const createIncident = catchAsync(async (req: Request, res: Response) => {
  // 1. Validate payload with Zod
  const validatedData = incidentSchema.parse(req.body);

  // 2. Authentication check
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  // 3. Inject authenticated reporter ID
  const incidentData = {
    ...validatedData,
    reporterId: req.user.id,
  };

  // 4. Delegate to service with evidence files
  const incident = await incidentService.createIncident(
    incidentData,
    req.files as Express.Multer.File[]
  );

  return res.status(201).json({
    success: true,
    message: 'Incident created successfully',
    incident,
  });
});

/**
 * GET /api/incidents/department/:departmentId
 * Controller for fetching all incidents in a department.
 */
export const getDepartmentIncidents = catchAsync(async (req: Request, res: Response) => {
  const params = departmentParamsSchema.parse(req.params);
  const departmentId = params.departmentId;

  const incidents = await incidentService.getIncidentsByDepartment(departmentId);
  return res.status(200).json({ success: true, data: incidents });
});

/**
 * GET /api/incidents/:id
 * Controller for retrieving single incident details with full relations.
 */
export const getIncidentById = catchAsync(async (req: Request, res: Response) => {
  const incidentId = Number(req.params.id);

  const incident = await incidentService.getIncidentById(incidentId);
  return res.status(200).json({ success: true, data: incident });
});

/**
 * GET /api/incidents/my and /api/incidents/my-incidents
 * Controller for fetching all incidents reported by the logged-in staff member.
 */
export const getMyIncidents = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated.', 401);
  }

  const reporterId = req.user.id;
  const incidents = await incidentService.getMyIncidents(reporterId);

  return res.status(200).json({
    success: true,
    data: incidents,
  });
});