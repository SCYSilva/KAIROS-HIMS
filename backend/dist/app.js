"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const incident_routes_1 = __importDefault(require("./modules/incidents/incident.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const errorHandler_middleware_1 = require("./shared/middleware/errorHandler.middleware"); // Import the handler
const departments_routes_1 = __importDefault(require("./modules/departments/departments.routes"));
const staff_routes_1 = __importDefault(require("./modules/staff/staff.routes"));
const manager_routes_1 = __importDefault(require("./modules/manager/manager.routes"));
const investigation_routes_1 = __importDefault(require("./modules/investigations/investigation.routes"));
const actionOwner_routes_1 = __importDefault(require("./modules/action-owner/actionOwner.routes"));
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
Routes
==========================================
*/
// Route mounting
app.use('/api/investigations', investigation_routes_1.default);
app.use('/api/staff', staff_routes_1.default);
app.use('/api/incidents', incident_routes_1.default);
app.use('/api/v1/incidents', incident_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/departments', departments_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/manager', manager_routes_1.default);
app.use('/api/action-owner', actionOwner_routes_1.default);
// Health Check Routes
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'KAIROS Backend is Running',
    });
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'KAIROS HIMS Backend is running' });
});
// IMPORTANT: The Global Error Handler MUST be the last middleware!
// If any route or middleware above calls next(error), it will come here.
app.use(errorHandler_middleware_1.globalErrorHandler);
exports.default = app;
