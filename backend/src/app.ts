// backend/src/app.ts

import express, { Request, Response } from 'express';
import cors from 'cors';
import incidentRoutes from './modules/incidents/incident.routes';
import authRoutes from './modules/auth/auth.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import staffRoutes from './modules/staff/staff.routes';
import managerRoutes from './modules/manager/manager.routes';
import investigationRoutes from './modules/investigations/investigation.routes';
import actionOwnerRoutes from './modules/action-owner/actionOwner.routes';
import adminRoutes from './modules/admin/admin.routes';

// Shared Services & Middleware Imports (Replaces standalone departments and users modules)
import { getAllDepartments } from './shared/services/department.service';
import { getUsersByRole } from './shared/services/user-lookup.service';
import { authenticate, authorizeRoles } from './shared/middleware/auth.middleware';
import { catchAsync } from './shared/utils/catchAsync';
import { globalErrorHandler } from './shared/middleware/errorHandler.middleware';

const app = express();

/*
==========================================
Middleware
==========================================
*/

// Allow requests from the React frontend
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost', 'http://localhost:80'],
    credentials: true,
  })
);

// Parse JSON request body
app.use(express.json());

/*
==========================================
Routes — Role-Based BFF Portals & Core Modules
==========================================
*/

// Core Role-Based Portals & Governance Modules
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/investigations', investigationRoutes);
app.use('/api/action-owner', actionOwnerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// Core Incident Entity Routes (Canonical & Legacy alias)
app.use('/api/incidents', incidentRoutes);
app.use('/api/v1/incidents', incidentRoutes);

/*
==========================================
Shared Cross-Cutting Endpoints
(Decoupled from decommissioned micro-modules)
==========================================
*/

/**
 * GET /api/departments
 * Authenticated endpoint delivering active hospital departments.
 * Directly backed by shared department service (zero module overhead).
 */
app.get(
  '/api/departments',
  authenticate,
  catchAsync(async (_req: Request, res: Response) => {
    const departments = await getAllDepartments();
    return res.status(200).json({
      success: true,
      data: departments,
    });
  })
);

/**
 * GET /api/users/role/:role
 * Authenticated & Manager/Admin authorized endpoint for user lookup by role.
 * Directly backed by shared user-lookup service (passwords safely omitted).
 */
app.get(
  '/api/users/role/:role',
  authenticate,
  authorizeRoles('MANAGER', 'ADMIN'),
  catchAsync(async (req: Request<{ role: string }>, res: Response) => {
    const users = await getUsersByRole(req.params.role);
    return res.status(200).json({
      success: true,
      data: users,
    });
  })
);

/*
==========================================
Health Check Endpoints
==========================================
*/

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'KAIROS Backend is Running',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', message: 'KAIROS HIMS Backend is running' });
});

/*
==========================================
Global Error Handler
(MUST be the last middleware mounted)
==========================================
*/
app.use(globalErrorHandler);

export default app;