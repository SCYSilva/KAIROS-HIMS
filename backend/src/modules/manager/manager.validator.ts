// backend/src/modules/manager/manager.validator.ts

import { z } from 'zod';

export const triageIncidentSchema = z.object({
  decision: z.enum(['ACCEPT', 'REVISE', 'REJECT'], {
    errorMap: () => ({ message: 'Decision must be ACCEPT, REVISE, or REJECT' }),
  }),
  rationale: z
    .string()
    .min(10, { message: 'Decision rationale must be at least 10 characters long' }),
});

export const recordCorrectionSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters' }).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  category: z.string().min(2, { message: 'Category is required' }).optional(),
  location: z.string().min(2, { message: 'Location is required' }).optional(),
  auditReason: z
    .string()
    .min(10, { message: 'Audit reason for correction must be at least 10 characters long' }),
});

export const assignLeadInvestigatorSchema = z.object({
  investigatorId: z.number().int().positive({ message: 'A valid investigator ID is required' }),
});

export const reviewFindingsSchema = z.object({
  decision: z.enum(['APPROVE', 'REVISE'], {
    errorMap: () => ({ message: 'Decision must be APPROVE or REVISE' }),
  }),
  comments: z.string().min(10, { message: 'Review comments must be at least 10 characters long' }),
});

export const createCapaActionSchema = z.object({
  title: z.string().min(5, { message: 'Action title must be at least 5 characters long' }),
  actionType: z.enum(['CORRECTIVE', 'PREVENTIVE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid ISO Due Date is required',
  }),
  actionOwnerId: z.number().int().positive({ message: 'Valid Action Owner ID is required' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters long' }),
});

export const verifyCapaActionSchema = z.object({
  decision: z.enum(['VERIFY', 'REVISE']),
  notes: z.string().optional(),
});

export const createIncidentControlSchema = z.object({
  controlType: z.string().min(3, { message: 'Control type must be at least 3 characters long' }),
  effectiveness: z.enum(['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE']),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'VERIFIED']),
  failureReason: z.string().optional(),
  requiredImprovement: z.string().optional(),
  targetDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid ISO Target Date is required',
  }),
});

export const managementReviewSchema = z.object({
  outcome: z.enum(['APPROVED', 'REVISION_REQUIRED']),
  lessonsLearned: z.string().min(15, { message: 'Lessons learned must be at least 15 characters' }),
  outcomeComments: z.string().min(10, { message: 'Outcome comments must be at least 10 characters' }),
  followUpMonitoring: z
    .string()
    .min(10, { message: 'Follow-up monitoring plan must be at least 10 characters' }),
  dissemination: z
    .object({
      audience: z.string().min(3, { message: 'Dissemination audience is required' }),
      scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Valid Scheduled Date is required',
      }),
      status: z.enum(['SCHEDULED', 'COMPLETED']).default('SCHEDULED'),
    })
    .optional(),
});

export const closeIncidentGateSchema = z.object({
  closureSummary: z
    .string()
    .min(20, { message: 'Clinical closure summary must be at least 20 characters long' }),
});

export const updateTeamRoleSchema = z.object({
  role: z.enum(['STAFF', 'INVESTIGATOR', 'ACTION_OWNER'], {
    errorMap: () => ({ message: 'Role must be STAFF, INVESTIGATOR, or ACTION_OWNER' }),
  }),
});

export const riskOverrideSchema = z.object({
  level: z.enum(['Low', 'Medium', 'High', 'Critical'], {
    errorMap: () => ({ message: 'Risk level must be Low, Medium, High or Critical' }),
  }),
  reason: z
    .string()
    .trim()
    .min(10, { message: 'Reason for changing the risk level must be at least 10 characters long' })
    .max(500, { message: 'Reason for changing the risk level must be at most 500 characters long' }),
});
