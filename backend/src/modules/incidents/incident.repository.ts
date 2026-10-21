// backend/src/modules/incidents/incident.repository.ts

import prisma from '../../shared/prisma/prisma';

/**
 * Database Repository for Core Incident Entity.
 * Encapsulates Prisma database queries for reading and fetching incident records.
 */
export class IncidentRepository {

  /**
   * Fetch all incidents belonging to a specific department.
   * Joins reporter, investigator, and action owner for manager overview.
   */
  async findByDepartmentId(departmentId: number) {
    return await prisma.incident.findMany({
      where: {
        departmentId: departmentId,
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        investigator: {
          select: {
            id: true,
            name: true,
          },
        },
        actionOwner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a single basic incident by its ID.
   */
  async findById(id: number) {
    return await prisma.incident.findUnique({
      where: { id: id },
    });
  }

  /**
   * Find a single incident with full clinical governance relations:
   * reporter, investigator, action owner, department, and file attachments.
   */
  async findByIdWithRelations(id: number) {
    return await prisma.incident.findUnique({
      where: { id: id },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        investigator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        actionOwner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        attachments: true,
      },
    });
  }

  /**
   * Get all incidents reported by a specific staff member.
   * Powers the "My Incidents" dashboard for clinical staff.
   */
  async findByReporterId(reporterId: number) {
    return await prisma.incident.findMany({
      where: {
        reporterId: reporterId,
      },
      include: {
        investigator: {
          select: {
            id: true,
            name: true,
          },
        },
        actionOwner: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        attachments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}

export const incidentRepository = new IncidentRepository();