// backend/src/modules/admin/admin.service.ts

import prisma from '../../shared/prisma/prisma';
import { AppError } from '../../shared/utils/AppError';

/**
 * Service Layer for System Admin Operations.
 * Provides hospital-wide governance, cross-department oversight,
 * system health counters, and enterprise user administration.
 */
export class AdminService {
  /**
   * Fetch high-level enterprise command metrics across all hospital departments.
   */
  async getSystemDashboard() {
    const [
      totalIncidents,
      openIncidents,
      criticalIncidents,
      totalUsers,
      totalDepartments,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.incident.count(),
      prisma.incident.count({ where: { status: { notIn: ['CLOSED', 'REJECTED'] } } }),
      prisma.incident.count({ where: { severity: 'CRITICAL', status: { not: 'CLOSED' } } }),
      prisma.user.count(),
      prisma.department.count(),
      prisma.incidentAuditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, role: true } },
          incident: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      kpis: {
        totalIncidents,
        activeIncidents: openIncidents,
        criticalUnresolved: criticalIncidents,
        registeredPersonnel: totalUsers,
        activeDepartments: totalDepartments,
      },
      recentActivity: recentAuditLogs,
    };
  }

  /**
   * Fetch all hospital departments with active personnel and incident counts.
   */
  async getAllDepartmentsWithStats() {
    return await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            incidents: true,
          },
        },
      },
    });
  }

  /**
   * Register a new hospital department.
   */
  async createDepartment(name: string) {
    const existing = await prisma.department.findUnique({
      where: { name },
    });

    if (existing) {
      throw new AppError('A hospital department with this name already exists.', 409);
    }

    return await prisma.department.create({
      data: { name },
    });
  }

  /**
   * Fetch complete hospital-wide user registry with departmental affiliations.
   * Passwords are safe-excluded.
   */
  async getAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Enterprise Role Assignment:
   * System Admin can change ANY user's role across any department.
   */
  async updateUserRole(targetUserId: number, newRole: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new AppError('Target user does not exist in the hospital registry.', 404);
    }

    return await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
      },
    });
  }

  /**
   * Retrieve hospital clinical governance audit logs.
   */
  async getAuditLogs(limit = 50) {
    return await prisma.incidentAuditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, role: true } },
        incident: { select: { id: true, title: true, departmentId: true } },
      },
    });
  }
}

export const adminService = new AdminService();