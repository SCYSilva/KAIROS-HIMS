import express from 'express';
import cors from 'cors';
import incidentRoutes from './modules/incidents/incident.routes';
import authRoutes from './modules/auth/auth.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import userRoutes from './modules/users/users.routes';
import { globalErrorHandler } from './shared/middleware/errorHandler.middleware'; // Import the handler
import departmentRoutes from './modules/departments/departments.routes';
import staffRoutes from './modules/staff/staff.routes';
import managerRoutes from './modules/manager/manager.routes';
import investigationRoutes from './modules/investigations/investigation.routes';
import actionOwnerRoutes from './modules/action-owner/actionOwner.routes';

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
Routes
==========================================
*/

// Route mounting
app.use('/api/investigations', investigationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/action-owner', actionOwnerRoutes);

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
app.use(globalErrorHandler);

export default app;
