// backend/src/modules/admin/admin.validator.ts

import { z } from 'zod';

/**
 * Validation schema for creating a new hospital department.
 */
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(2, 'Department name must be at least 2 characters long')
    .max(100, 'Department name cannot exceed 100 characters')
    .trim(),
});

/**
 * Validation schema for updating any user's role across the hospital.
 * System Admin can assign any supported system role.
 */
export const adminUpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'INVESTIGATOR', 'ACTION_OWNER', 'STAFF'], {
    errorMap: () => ({
      message: 'Role must be ADMIN, MANAGER, INVESTIGATOR, ACTION_OWNER, or STAFF',
    }),
  }),
});