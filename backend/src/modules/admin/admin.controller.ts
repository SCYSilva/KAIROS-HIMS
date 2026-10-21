// backend/src/modules/admin/admin.controller.ts

import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync';
import { adminService } from './admin.service';
import { createDepartmentSchema, adminUpdateRoleSchema } from './admin.validator';

/**
 * GET /api/admin/dashboard
 * Delivers system-wide operational metrics and audit counters.
 */
export const getAdminDashboard = catchAsync(async (_req: Request, res: Response) => {
  const data = await adminService.getSystemDashboard();
  return res.status(200).json({ success: true, data });
});

/**
 * GET /api/admin/departments
 * Retrieves all departments with aggregated personnel and incident counts.
 */
export const getAdminDepartments = catchAsync(async (_req: Request, res: Response) => {
  const data = await adminService.getAllDepartmentsWithStats();
  return res.status(200).json({ success: true, data });
});

/**
 * POST /api/admin/departments
 * Creates a new hospital department.
 */
export const createDepartment = catchAsync(async (req: Request, res: Response) => {
  const { name } = createDepartmentSchema.parse(req.body);
  const department = await adminService.createDepartment(name);

  return res.status(201).json({
    success: true,
    message: 'Hospital department registered successfully',
    data: department,
  });
});

/**
 * GET /api/admin/users
 * Retrieves enterprise user directory.
 */
export const getAdminUsers = catchAsync(async (_req: Request, res: Response) => {
  const data = await adminService.getAllUsers();
  return res.status(200).json({ success: true, data });
});

/**
 * PATCH /api/admin/users/:userId/role
 * Changes any user's role across any department.
 */
export const updateAdminUserRole = catchAsync(async (req: Request, res: Response) => {
  const targetUserId = parseInt(req.params.userId as string, 10);
  const { role } = adminUpdateRoleSchema.parse(req.body);

  const updatedUser = await adminService.updateUserRole(targetUserId, role);

  return res.status(200).json({
    success: true,
    message: `User role successfully updated to ${role}`,
    data: updatedUser,
  });
});

/**
 * GET /api/admin/audit-logs
 * Retrieves clinical governance audit trails.
 */
export const getAdminAuditLogs = catchAsync(async (_req: Request, res: Response) => {
  const logs = await adminService.getAuditLogs();
  return res.status(200).json({ success: true, data: logs });
});