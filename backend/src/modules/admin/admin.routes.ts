// backend/src/modules/admin/admin.routes.ts

import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../shared/middleware/auth.middleware';
import {
  getAdminDashboard,
  getAdminDepartments,
  createDepartment,
  getAdminUsers,
  updateAdminUserRole,
  getAdminAuditLogs,
} from './admin.controller';

const router = Router();

// ==========================================
// SECURITY GATE: SYSTEM ADMIN ONLY
// All endpoints below require a valid JWT token
// AND the user must possess the 'ADMIN' role.
// ==========================================
router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

// Enterprise Executive Oversight
router.get('/dashboard', getAdminDashboard);
router.get('/audit-logs', getAdminAuditLogs);

// Hospital Department Administration
router.get('/departments', getAdminDepartments);
router.post('/departments', createDepartment);

// Enterprise Personnel Management
router.get('/users', getAdminUsers);
router.patch('/users/:userId/role', updateAdminUserRole);

export default router;