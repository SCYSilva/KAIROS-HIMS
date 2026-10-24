// backend/src/modules/manager/manager.controller.ts

import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync';
import { AppError } from '../../shared/utils/AppError';
import { managerService } from './manager.service';
import {
  triageIncidentSchema,
  recordCorrectionSchema,
  assignLeadInvestigatorSchema,
  reviewFindingsSchema,
  createCapaActionSchema,
  verifyCapaActionSchema,
  createIncidentControlSchema,
  managementReviewSchema,
  closeIncidentGateSchema,
  updateTeamRoleSchema,
  riskOverrideSchema,
} from './manager.validator';

const getAuthContext = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }
  return {
    userId: req.user.id,
    departmentId: req.user.departmentId,
  };
};

// Safe helper to extract and parse numeric route parameters
const parseParamId = (paramValue: unknown, paramName: string): number => {
  const str = Array.isArray(paramValue) ? paramValue[0] : (paramValue as string);
  const id = parseInt(str, 10);
  if (isNaN(id)) {
    throw new AppError(`Invalid ${paramName} provided in the URL parameter.`, 400);
  }
  return id;
};

export const getManagerDashboard = catchAsync(async (req: Request, res: Response) => {
  const { departmentId } = getAuthContext(req);
  const data = await managerService.getDashboard(departmentId);
  return res.status(200).json({ success: true, data });
});

export const getManagerAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { departmentId } = getAuthContext(req);
  const data = await managerService.getAnalytics(departmentId);
  return res.status(200).json({ success: true, data });
});

export const getDepartmentTeam = catchAsync(async (req: Request, res: Response) => {
  const { departmentId } = getAuthContext(req);
  const data = await managerService.getTeam(departmentId);
  return res.status(200).json({ success: true, data });
});

export const updateTeamRole = catchAsync(async (req: Request, res: Response) => {
  const { departmentId } = getAuthContext(req);
  const targetUserId = parseParamId(req.params.userId, 'user ID');

  const { role } = updateTeamRoleSchema.parse(req.body);
  const updatedUser = await managerService.updateTeamRole(departmentId, targetUserId, role);

  return res.status(200).json({
    success: true,
    message: `User role successfully updated to ${role}`,
    data: updatedUser,
  });
});

export const getManagerIncidentDetails = catchAsync(async (req: Request, res: Response) => {
  const { departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const incident = await managerService.getIncidentDetails(incidentId, departmentId);
  return res.status(200).json({ success: true, data: incident });
});

export const getIncidentRiskAssessment = catchAsync(async (req: Request, res: Response) => {
  const { departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const data = await managerService.getIncidentRiskAssessment(incidentId, departmentId);
  return res.status(200).json({ success: true, data });
});

export const setIncidentRiskOverride = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const { level, reason } = riskOverrideSchema.parse(req.body);
  const data = await managerService.setRiskOverride(incidentId, departmentId, userId, level, reason);

  return res.status(200).json({ success: true, message: `Risk level set to ${level}`, data });
});

export const clearIncidentRiskOverride = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const data = await managerService.clearRiskOverride(incidentId, departmentId, userId);

  return res.status(200).json({ success: true, message: 'Reverted to the AI prediction', data });
});

export const triageIncident = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const { decision, rationale } = triageIncidentSchema.parse(req.body);
  const result = await managerService.triageIncident(
    incidentId,
    departmentId,
    userId,
    decision,
    rationale
  );

  return res.status(200).json({
    success: true,
    message: `Incident triage recorded successfully as ${decision}`,
    data: result,
  });
});

export const correctIncidentRecord = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const parsed = recordCorrectionSchema.parse(req.body);
  const result = await managerService.correctRecord(incidentId, departmentId, userId, parsed);

  return res.status(200).json({
    success: true,
    message: 'Audited record corrections applied successfully',
    data: result,
  });
});

export const assignInvestigator = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const { investigatorId } = assignLeadInvestigatorSchema.parse(req.body);
  const result = await managerService.assignInvestigator(
    incidentId,
    departmentId,
    userId,
    investigatorId
  );

  return res.status(200).json({
    success: true,
    message: 'Lead investigator assigned and incident transitioned to INVESTIGATING',
    data: result,
  });
});

export const reviewInvestigation = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const { decision, comments } = reviewFindingsSchema.parse(req.body);
  const result = await managerService.reviewInvestigationFindings(
    incidentId,
    departmentId,
    userId,
    decision,
    comments
  );

  return res.status(200).json({
    success: true,
    message: `Investigation findings ${decision.toLowerCase()}ed`,
    data: result,
  });
});

export const createCapaAction = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const parsed = createCapaActionSchema.parse(req.body);
  const action = await managerService.createCapaAction(incidentId, departmentId, userId, parsed);

  return res.status(201).json({
    success: true,
    message: 'CAPA action created successfully',
    data: action,
  });
});

export const verifyCapaAction = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');
  const actionId = parseParamId(req.params.actionId, 'action ID');

  const { decision, notes } = verifyCapaActionSchema.parse(req.body);
  const updatedAction = await managerService.verifyCapaAction(
    incidentId,
    actionId,
    departmentId,
    userId,
    decision,
    notes
  );

  return res.status(200).json({
    success: true,
    message: `Action verification marked as ${decision}`,
    data: updatedAction,
  });
});

export const createControl = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const parsed = createIncidentControlSchema.parse(req.body);
  const control = await managerService.createControl(incidentId, departmentId, userId, parsed);

  return res.status(201).json({
    success: true,
    message: 'Incident risk control registered',
    data: control,
  });
});

export const submitManagementReview = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const parsed = managementReviewSchema.parse(req.body);
  const review = await managerService.submitReview(incidentId, departmentId, userId, parsed);

  return res.status(200).json({
    success: true,
    message: 'Management review saved and incident marked UNDER_REVIEW',
    data: review,
  });
});

export const closeIncident = catchAsync(async (req: Request, res: Response) => {
  const { userId, departmentId } = getAuthContext(req);
  const incidentId = parseParamId(req.params.id, 'incident ID');

  const { closureSummary } = closeIncidentGateSchema.parse(req.body);
  const closedIncident = await managerService.closeIncident(
    incidentId,
    departmentId,
    userId,
    closureSummary
  );

  return res.status(200).json({
    success: true,
    message: 'All 3 Governance Gates satisfied. Incident CLOSED.',
    data: closedIncident,
  });
});