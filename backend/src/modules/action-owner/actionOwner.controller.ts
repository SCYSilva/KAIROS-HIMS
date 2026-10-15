import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync';
import { actionOwnerService, ActionOwnerActor } from './actionOwner.service';
import {
  actionIdSchema,
  actionListSchema,
  progressSchema,
  resubmitSchema,
  managerActionReviewSchema,
} from './actionOwner.validator';

const getActor = (req: Request): ActionOwnerActor => ({
  id: req.user!.id,
  role: req.user!.role,
  departmentId: req.user!.departmentId,
});

export const getActionDashboard = catchAsync(async (req: Request, res: Response) => {
  const query = actionListSchema.parse(req.query);
  const data = await actionOwnerService.dashboard(getActor(req), query);
  return res.status(200).json({ success: true, data });
});

export const getActionDetail = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const data = await actionOwnerService.detail(id, getActor(req));
  return res.status(200).json({ success: true, data });
});

export const updateActionProgress = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const body = progressSchema.parse(req.body);
  const data = await actionOwnerService.updateProgress(id, body, getActor(req));
  return res.status(200).json({
    success: true,
    message: body.status === 'COMPLETED'
      ? 'Action submitted for Manager verification.'
      : 'Action progress saved and recorded in audit trail.',
    data,
  });
});

export const resubmitAction = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const body = resubmitSchema.parse(req.body);
  const data = await actionOwnerService.resubmit(id, body, getActor(req));
  return res.status(200).json({
    success: true,
    message: 'Action resubmitted for Manager verification.',
    data,
  });
});

export const uploadActionEvidence = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const data = await actionOwnerService.addEvidence(id, req.file, getActor(req));
  return res.status(201).json({
    success: true,
    message: 'Evidence document uploaded securely.',
    data,
  });
});

export const viewActionEvidence = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const evidenceId = actionIdSchema.parse(req.params.evidenceId);
  const file = await actionOwnerService.getEvidenceFile(id, evidenceId, getActor(req));
  return res.type(file.fileType).sendFile(file.absolutePath);
});

export const getActionInsights = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const data = await actionOwnerService.insights(id, getActor(req));
  return res.status(200).json({ success: true, data });
});

export const readNotification = catchAsync(async (req: Request, res: Response) => {
  const id = actionIdSchema.parse(req.params.id);
  const data = await actionOwnerService.markNotificationRead(id, getActor(req));
  return res.status(200).json({ success: true, data });
});

export const managerReviewAction = catchAsync(async (req: Request, res: Response) => {
  const incidentId = actionIdSchema.parse(req.params.id);
  const actionId = actionIdSchema.parse(req.params.actionId);
  const body = managerActionReviewSchema.parse(req.body);
  const data = await actionOwnerService.managerReview(incidentId, actionId, body, req.user!.id);
  return res.status(200).json({
    success: true,
    message: body.decision === 'VERIFY'
      ? 'Action verified effective by Department Manager.'
      : 'Action returned to Action Owner for revision.',
    data,
  });
});
