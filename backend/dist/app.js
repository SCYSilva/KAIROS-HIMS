"use strict";
// backend/src/app.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const incident_routes_1 = __importDefault(require("./modules/incidents/incident.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const staff_routes_1 = __importDefault(require("./modules/staff/staff.routes"));
const manager_routes_1 = __importDefault(require("./modules/manager/manager.routes"));
const investigation_routes_1 = __importDefault(require("./modules/investigations/investigation.routes"));
const actionOwner_routes_1 = __importDefault(require("./modules/action-owner/actionOwner.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
// Shared Services & Middleware Imports (Replaces standalone departments and users modules)
const department_service_1 = require("./shared/services/department.service");
const user_lookup_service_1 = require("./shared/services/user-lookup.service");
const auth_middleware_1 = require("./shared/middleware/auth.middleware");
const catchAsync_1 = require("./shared/utils/catchAsync");
const errorHandler_middleware_1 = require("./shared/middleware/errorHandler.middleware");
const app = (0, express_1.default)();
/*
==========================================
Middleware
==========================================
*/
// Allow requests from the React frontend
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://localhost', 'http://localhost:80'],
    credentials: true,
}));
// Parse JSON request body
app.use(express_1.default.json());
/*
==========================================
Routes — Role-Based BFF Portals & Core Modules
==========================================
*/
// Core Role-Based Portals & Governance Modules
app.use('/api/auth', auth_routes_1.default);
app.use('/api/staff', staff_routes_1.default);
app.use('/api/manager', manager_routes_1.default);
app.use('/api/investigations', investigation_routes_1.default);
app.use('/api/action-owner', actionOwner_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
// Core Incident Entity Routes (Canonical & Legacy alias)
app.use('/api/incidents', incident_routes_1.default);
app.use('/api/v1/incidents', incident_routes_1.default);
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
app.get('/api/departments', auth_middleware_1.authenticate, (0, catchAsync_1.catchAsync)(async (_req, res) => {
    const departments = await (0, department_service_1.getAllDepartments)();
    return res.status(200).json({
        success: true,
        data: departments,
    });
}));
/**
 * GET /api/users/role/:role
 * Authenticated & Manager/Admin authorized endpoint for user lookup by role.
 * Directly backed by shared user-lookup service (passwords safely omitted).
 */
app.get('/api/users/role/:role', auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeRoles)('MANAGER', 'ADMIN'), (0, catchAsync_1.catchAsync)(async (req, res) => {
    const users = await (0, user_lookup_service_1.getUsersByRole)(req.params.role);
    return res.status(200).json({
        success: true,
        data: users,
    });
}));
/*
==========================================
Health Check Endpoints
==========================================
*/
app.get('/', (_req, res) => {
    res.json({
        success: true,
        message: 'KAIROS Backend is Running',
    });
});
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'UP', message: 'KAIROS HIMS Backend is running' });
});
/*
==========================================
Global Error Handler
(MUST be the last middleware mounted)
==========================================
*/
app.use(errorHandler_middleware_1.globalErrorHandler);
exports.default = app;
