import { AiFeedbackAction, InvestigationMethod, InvestigationStatus, Severity } from '@prisma/client';
import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();

export const dashboardQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(InvestigationStatus).optional(),
  severity: z.nativeEnum(Severity).optional(),
  due: z.enum(['OVERDUE', 'NEXT_7_DAYS', 'NO_DATE']).optional(),
});

export const factorSchema = z.object({
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(100),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(1000),
});

export const draftSchema = z
  .object({
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    method: z.nativeEnum(InvestigationMethod).optional().nullable(),
    methodOther: z.string().trim().max(200).optional().nullable(),
    findingsSummary: z.string().trim().max(5000).optional().nullable(),
    rootCauseCategory: z.string().trim().max(100).optional().nullable(),
    rootCauseSubcategory: z.string().trim().max(100).optional().nullable(),
    rootCauseDescription: z.string().trim().max(5000).optional().nullable(),
    rootCauseMethod: z.nativeEnum(InvestigationMethod).optional().nullable(),
    rootCauseDetail: z.string().trim().max(8000).optional().nullable(),
    systemicIssue: z.boolean().optional(),
    contributingFactors: z.array(factorSchema).max(20).optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: 'Target/end date cannot be before start date',
  });

export const teamSchema = z.object({
  userId: idSchema,
  role: z.string().trim().min(2, 'Role must be at least 2 characters').max(100).default('Co-Investigator'),
});

export const witnessSchema = z.object({
  name: z.string().trim().min(2, 'Witness name is required').max(200),
  roleOrContact: z.string().trim().max(300).optional().nullable(),
  statement: z.string().trim().max(5000).optional().nullable(),
  interviewedAt: z.coerce.date().optional().nullable(),
});

export const timelineSchema = z.object({
  occurredAt: z.coerce.date(),
  title: z.string().trim().min(2, 'Event title is required').max(200),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(3000),
  source: z.string().trim().max(500).optional().nullable(),
});

export const evidenceSchema = z.object({
  attachmentId: idSchema.optional().nullable(),
  label: z.string().trim().min(2, 'Evidence label is required').max(200),
  reference: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
});

export const linkSchema = z.object({
  targetIncidentId: idSchema,
  reason: z.string().trim().min(10, 'Link reason must be at least 10 characters').max(1000),
});

export const aiFeedbackSchema = z.object({
  feature: z.string().trim().min(2).max(100),
  resultKey: z.string().trim().min(1).max(200),
  action: z.nativeEnum(AiFeedbackAction),
  reason: z.string().trim().max(1000).optional().nullable(),
  modelVersion: z.string().trim().min(2).max(100),
});
