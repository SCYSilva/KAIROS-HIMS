import { Request, Response } from 'express';
import { AppError } from '../../shared/utils/AppError';
import { catchAsync } from '../../shared/utils/catchAsync';
import { investigationService, InvestigationActor } from './investigation.service';
import {
  aiFeedbackSchema,
  dashboardQuerySchema,
  draftSchema,
  evidenceSchema,
  idSchema,
  linkSchema,
  teamSchema,
  timelineSchema,
  witnessSchema,
} from './investigation.validator';

const actorFrom = (req: Request): InvestigationActor => {
  if (!req.user) throw new AppError('User authentication required.', 401);
  return {
    id: req.user.id,
    role: req.user.role,
    departmentId: req.user.departmentId,
    ipAddress: req.ip,
  };
};

const queryFrom = (req: Request) =>
  Object.fromEntries(
    Object.entries(req.query).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0]) : String(value ?? ''),
    ])
  );

export const getAssignedIncidents = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('User not authenticated.', 401);
  const data = await investigationService.getAssignedIncidents(req.user.id);
  res.json({ success: true, data });
});

export const getDashboard = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const query = dashboardQuerySchema.parse(queryFrom(req));
  const data = await investigationService.dashboard(actor, query);
  res.json({ success: true, data });
});

export const getWorkspace = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const data = await investigationService.workspace(incidentId, actor);
  res.json({ success: true, data });
});

export const getCandidates = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const data = await investigationService.candidates(incidentId, actor);
  res.json({ success: true, data });
});

export const saveDraft = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = draftSchema.parse(req.body);
  const data = await investigationService.saveDraft(incidentId, parsed, actor);
  res.json({
    success: true,
    message: 'Investigation draft saved without advancing workflow.',
    data,
  });
});

export const addTeamMember = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = teamSchema.parse(req.body);
  const data = await investigationService.addTeamMember(incidentId, parsed, actor);
  res.status(201).json({ success: true, message: 'Team member added.', data });
});

export const removeTeamMember = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const userId = idSchema.parse(req.params.userId);
  await investigationService.removeTeamMember(incidentId, userId, actor);
  res.json({ success: true, message: 'Team member removed from investigation.' });
});

export const addWitness = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = witnessSchema.parse(req.body);
  const data = await investigationService.addWitness(incidentId, parsed, actor);
  res.status(201).json({ success: true, message: 'Witness statement recorded.', data });
});

export const addTimeline = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = timelineSchema.parse(req.body);
  const data = await investigationService.addTimeline(incidentId, parsed, actor);
  res.status(201).json({ success: true, message: 'Timeline event logged.', data });
});

export const addEvidence = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = evidenceSchema.parse(req.body);
  const data = await investigationService.addEvidence(incidentId, parsed, actor);
  res.status(201).json({ success: true, message: 'Evidence reference attached.', data });
});

export const linkIncident = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = linkSchema.parse(req.body);
  const data = await investigationService.linkIncident(incidentId, parsed, actor);
  res.status(201).json({ success: true, message: 'Related incident linked.', data });
});

export const submitInvestigation = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const data = await investigationService.submit(incidentId, actor);
  res.json({
    success: true,
    message: 'Investigation findings successfully submitted for Manager review.',
    data,
  });
});

export const getDecisionSupport = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const data = await investigationService.decisionSupport(incidentId, actor);
  res.json({ success: true, data });
});

export const recordAiFeedback = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const parsed = aiFeedbackSchema.parse(req.body);
  const data = await investigationService.recordAiFeedback(incidentId, parsed, actor);
  res.status(201).json({ success: true, data });
});

export const submitRootCause = catchAsync(async (req: Request, res: Response) => {
  const actor = actorFrom(req);
  const incidentId = idSchema.parse(req.params.id);
  const { rootCause, rootCauseCategory } = req.body;
  if (!rootCause || rootCause.length < 20) {
    throw new AppError('Root cause findings must be at least 20 characters.', 400);
  }
  if (!rootCauseCategory) {
    throw new AppError('Root cause category is required.', 400);
  }
  const data = await investigationService.submitRootCauseLegacy(
    incidentId,
    rootCause,
    rootCauseCategory,
    actor
  );
  res.json({ success: true, message: 'Root cause submitted successfully.', data });
});
