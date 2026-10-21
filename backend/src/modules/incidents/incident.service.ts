// backend/src/modules/incidents/incident.service.ts

import prisma from '../../shared/prisma/prisma';
import { incidentRepository } from './incident.repository';
import { AppError } from '../../shared/utils/AppError';

/**
 * Service Layer for Core Incident Entity.
 * Handles incident creation, department queries, single incident retrieval,
 * and Staff "My Incidents" aggregation summary.
 */
export class IncidentService {
  /**
   * Create a new incident report with optional evidence attachments.
   * Validates department and reporter existence before persisting to database.
   */
  async createIncident(data: any, files: Express.Multer.File[]) {
    const departmentId = Number(data.departmentId);
    const reporterId = Number(data.reporterId);

    if (!departmentId || departmentId <= 0) {
      throw new AppError('Invalid department ID provided.', 400);
    }

    if (!reporterId || reporterId <= 0) {
      throw new AppError('Invalid reporter ID provided.', 400);
    }

    const [departmentExists, reporterExists] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId } }),
      prisma.user.findUnique({ where: { id: reporterId } }),
    ]);

    if (!departmentExists) {
      throw new AppError('The selected department does not exist.', 404);
    }

    if (!reporterExists) {
      throw new AppError('The reporter user does not exist.', 404);
    }

    // Create incident record with initial status OPEN
    const incident = await prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        severity: data.severity,
        category: data.category,
        location: data.location,
        status: 'OPEN',
        departmentId,
        reporterId,
      },
    });

    // Save attached evidence documents if present
    if (files && files.length > 0) {
      await prisma.incidentAttachment.createMany({
        data: files.map((file) => ({
          fileName: file.originalname,
          filePath: file.path,
          fileType: file.mimetype,
          incidentId: incident.id,
        })),
      });
    }

    return incident;
  }

  /**
   * Get a single incident by its ID with full relation tree.
   */
  async getIncidentById(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Invalid incident ID provided.', 400);
    }

    const incident = await incidentRepository.findByIdWithRelations(id);

    if (!incident) {
      throw new AppError('Incident not found.', 404);
    }

    return incident;
  }

  /**
   * Get all incidents for a specific department.
   */
  async getIncidentsByDepartment(departmentId: number) {
    if (!departmentId || departmentId <= 0) {
      throw new AppError('Invalid Department ID provided', 400);
    }

    const departmentExists = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!departmentExists) {
      throw new AppError('Department not found.', 404);
    }

    return await incidentRepository.findByDepartmentId(departmentId);
  }

  /**
   * Get all incidents reported by the logged-in staff member.
   * Calculates status metric summary (open, in-progress, closed)
   * and generates standardized reference IDs (INC-YYYY-XXXX).
   */
  async getMyIncidents(reporterId: number) {
    if (!reporterId || reporterId <= 0) {
      throw new AppError('Invalid reporter ID.', 400);
    }

    const rawIncidents = await incidentRepository.findByReporterId(reporterId);

    const total = rawIncidents.length;
    const open = rawIncidents.filter((i) => i.status === 'OPEN' || i.status === 'ACCEPTED').length;
    const inProgress = rawIncidents.filter((i) =>
      ['INVESTIGATING', 'PENDING_ACTION', 'UNDER_REVIEW'].includes(i.status)
    ).length;
    const closed = rawIncidents.filter((i) => i.status === 'CLOSED').length;

    const items = rawIncidents.map((incident) => {
      const year = new Date(incident.createdAt).getFullYear();
      const referenceId = `INC-${year}-${String(incident.id).padStart(4, '0')}`;

      let category = incident.category;
      let subcategory = '';
      if (incident.category.includes(' - ')) {
        const parts = incident.category.split(' - ');
        category = parts[0];
        subcategory = parts.slice(1).join(' - ');
      }

      return {
        ...incident,
        referenceId,
        category,
        subcategory,
        reportedAt: incident.createdAt.toISOString(),
      };
    });

    return {
      summary: {
        total,
        open,
        inProgress,
        closed,
      },
      items,
    };
  }
}

// Export singleton instance of IncidentService
export const incidentService = new IncidentService();