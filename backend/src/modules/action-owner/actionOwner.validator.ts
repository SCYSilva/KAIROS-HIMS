import { z } from 'zod';

export const actionIdSchema = z.coerce.number().int().positive('Action ID must be a positive integer.');

export const actionListSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  due: z.enum(['ALL', 'DUE_SOON', 'OVERDUE']).default('ALL'),
});

export const progressSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED']),
  progressNote: z.string().trim().min(5, 'Progress note must be at least 5 characters long.').max(3000),
  verificationNotes: z.string().trim().max(3000).optional(),
}).superRefine((val, ctx) => {
  if (val.status === 'COMPLETED') {
    if (!val.verificationNotes || val.verificationNotes.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verificationNotes'],
        message: 'Verification notes (minimum 10 characters) are mandatory when completing an action.',
      });
    }
  }
});

export const resubmitSchema = z.object({
  progressNote: z.string().trim().min(5, 'Progress note must be at least 5 characters long.').max(3000),
  verificationNotes: z.string().trim().min(10, 'Verification notes must be at least 10 characters long.').max(3000),
});

export const managerActionReviewSchema = z.object({
  decision: z.enum(['VERIFY', 'RETURN']),
  comment: z.string().trim().min(5, 'Manager review comment must be at least 5 characters long.').max(3000),
  effectiveness: z.enum(['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE']).optional().default('EFFECTIVE'),
  effectivenessScore: z.coerce.number().min(0).max(100).optional().default(100),
});

export type ActionListQuery = z.infer<typeof actionListSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type ResubmitInput = z.infer<typeof resubmitSchema>;
export type ManagerActionReviewInput = z.infer<typeof managerActionReviewSchema>;
