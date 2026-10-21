// backend/src/modules/manager/manager.service.ts

import prisma from '../../shared/prisma/prisma';
import { AppError } from '../../shared/utils/AppError';

export class ManagerService {
  /**
   * High-Level Executive Dashboard Metrics for the Department
   */
  /**
   * Aggregated Executive Command Centre Dashboard for Department Manager
   * Produces real-time Tier 1 KPIs, Tier 2 Attention Queue & Department Health, and Tier 3 Overdue Actions
   */
  async getDashboard(departmentId: number) {
    const now = new Date();

    // Execute parallel database queries via Promise.all for high-performance aggregation
    const [
      totalCount,
      openCount,
      unassignedCount,
      findingsToApproveCount,
      awaitingVerificationCount,
      overdueActionsCount,
      highRiskOpenCount,
      closedCount,
      activeIncidentsCount,
      oldestOpenIncident,
      totalCapasCount,
      completedCapasCount,
      attentionTriageList,
      attentionFindingsList,
      attentionVerificationList,
      overdueCapasList,
    ] = await Promise.all([
      // 1. Total incidents in department
      prisma.incident.count({ where: { departmentId } }),

      // 2. Triage pending incidents (OPEN)
      prisma.incident.count({ where: { departmentId, status: 'OPEN' } }),

      // 3. Accepted incidents without an assigned investigator
      prisma.incident.count({
        where: { departmentId, status: 'ACCEPTED', investigatorId: null },
      }),

      // 4. Investigations awaiting manager findings review
      prisma.incident.count({
        where: {
          departmentId,
          status: 'INVESTIGATING',
          investigationReviewStatus: 'PENDING',
        },
      }),

      // 5. Completed CAPA actions awaiting manager verification
      prisma.capaAction.count({
        where: {
          incident: { departmentId },
          status: 'COMPLETED',
          isVerified: false,
        },
      }),

      // 6. Overdue CAPA actions
      prisma.capaAction.count({
        where: {
          incident: { departmentId },
          dueDate: { lt: now },
          status: { not: 'COMPLETED' },
        },
      }),

      // 7. Unresolved high or critical severity incidents
      prisma.incident.count({
        where: {
          departmentId,
          severity: { in: ['HIGH', 'CRITICAL'] },
          status: { notIn: ['CLOSED', 'REJECTED'] },
        },
      }),

      // 8. Total closed incidents
      prisma.incident.count({ where: { departmentId, status: 'CLOSED' } }),

      // 9. Total active (ongoing) incidents
      prisma.incident.count({
        where: { departmentId, status: { notIn: ['CLOSED', 'REJECTED'] } },
      }),

      // 10. Oldest unresolved incident for SLA duration calculation
      prisma.incident.findFirst({
        where: { departmentId, status: { notIn: ['CLOSED', 'REJECTED'] } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // 11. Total CAPAs created in department
      prisma.capaAction.count({ where: { incident: { departmentId } } }),

      // 12. Completed CAPAs count
      prisma.capaAction.count({
        where: { incident: { departmentId }, status: 'COMPLETED' },
      }),

      // 13. Top 5 pending triage incidents for Attention Queue
      prisma.incident.findMany({
        where: { departmentId, status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, title: true, severity: true, createdAt: true },
      }),

      // 14. Top 5 investigations awaiting review for Attention Queue
      prisma.incident.findMany({
        where: {
          departmentId,
          status: 'INVESTIGATING',
          investigationReviewStatus: 'PENDING',
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          severity: true,
          investigator: { select: { name: true } },
        },
      }),

      // 15. Top 5 completed CAPAs awaiting verification for Attention Queue
      prisma.capaAction.findMany({
        where: {
          incident: { departmentId },
          status: 'COMPLETED',
          isVerified: false,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          priority: true,
          incidentId: true,
          incident: { select: { severity: true } },
          actionOwner: { select: { name: true } },
        },
      }),

      // 16. Overdue CAPAs for Workbench and Attention Queue
      prisma.capaAction.findMany({
        where: {
          incident: { departmentId },
          dueDate: { lt: now },
          status: { not: 'COMPLETED' },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: {
          id: true,
          title: true,
          priority: true,
          dueDate: true,
          incidentId: true,
          incident: { select: { title: true, severity: true } },
          actionOwner: { select: { name: true, email: true } },
        },
      }),
    ]);

    // Tier 1: Top Decision Counters (KPIs)
    const kpis = {
      awaitingDecisionCount: openCount,
      unassignedCount,
      findingsToApproveCount,
      awaitingVerificationCount,
      overdueActionsCount,
      highRiskOpenCount,
    };

    // Tier 2: Priority Attention Queue items
    const attentionItems = [
      ...overdueCapasList.slice(0, 3).map((item) => ({
        id: item.id,
        incidentId: item.incidentId,
        title: item.title,
        type: 'ACTION_OVERDUE' as const,
        severity: item.incident.severity,
        priority: item.priority,
        assigneeName: item.actionOwner?.name ?? 'Unassigned',
        dueDate: item.dueDate.toISOString(),
        daysOverdue: Math.max(
          1,
          Math.floor((now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        ),
      })),
      ...attentionTriageList.map((item) => ({
        id: item.id,
        incidentId: item.id,
        title: item.title,
        type: 'TRIAGE_PENDING' as const,
        severity: item.severity,
      })),
      ...attentionFindingsList.map((item) => ({
        id: item.id,
        incidentId: item.id,
        title: item.title,
        type: 'FINDINGS_REVIEW' as const,
        severity: item.severity,
        assigneeName: item.investigator?.name ?? 'Unassigned',
      })),
      ...attentionVerificationList.map((item) => ({
        id: item.id,
        incidentId: item.incidentId,
        title: item.title,
        type: 'VERIFICATION_PENDING' as const,
        severity: item.incident.severity,
        priority: item.priority,
        assigneeName: item.actionOwner?.name ?? 'Unassigned',
      })),
    ];

    // Tier 2: Department Health Metrics
    const closureRatePercentage =
      totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 100;

    const actionCompletionPercentage =
      totalCapasCount > 0 ? Math.round((completedCapasCount / totalCapasCount) * 100) : 100;

    const activeCapasCount = totalCapasCount - completedCapasCount;
    const slaCompliancePercentage =
      activeCapasCount > 0
        ? Math.max(
            0,
            Math.round(((activeCapasCount - overdueActionsCount) / activeCapasCount) * 100)
          )
        : 100;

    const oldestOpenIncidentDays = oldestOpenIncident
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(oldestOpenIncident.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    const departmentHealth = {
      closureRatePercentage,
      actionCompletionPercentage,
      slaCompliancePercentage,
      openIncidentsCount: activeIncidentsCount,
      oldestOpenIncidentDays,
    };

    // Tier 3: Overdue Actions Workbench
    const overdueActions = overdueCapasList.map((item) => ({
      actionId: item.id,
      incidentId: item.incidentId,
      incidentTitle: item.incident.title,
      actionTitle: item.title,
      assignedOwnerName: item.actionOwner?.name ?? 'Unassigned',
      assignedOwnerEmail: item.actionOwner?.email ?? '',
      severity: item.incident.severity,
      priority: item.priority,
      dueDate: item.dueDate.toISOString(),
      daysOverdue: Math.max(
        1,
        Math.floor((now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      ),
    }));

    return {
      kpis,
      attentionItems,
      departmentHealth,
      overdueActions,
    };
  }

  /**
   * Resilient Clinical Governance Analytics (Zero-Division Safe)
   */
  async getAnalytics(departmentId: number) {
    const [
      totalCount,
      openCount,
      criticalCount,
      closedCount,
      closedIncidents,
      byStatusRaw,
      bySeverityRaw,
      byCategoryRaw,
    ] = await Promise.all([
      prisma.incident.count({ where: { departmentId } }),
      prisma.incident.count({ where: { departmentId, status: 'OPEN' } }),
      prisma.incident.count({ where: { departmentId, severity: 'CRITICAL' } }),
      prisma.incident.count({ where: { departmentId, status: 'CLOSED' } }),
      prisma.incident.findMany({
        where: { departmentId, status: 'CLOSED', closedAt: { not: null } },
        select: { createdAt: true, closedAt: true },
      }),
      prisma.incident.groupBy({
        by: ['status'],
        where: { departmentId },
        _count: { status: true },
      }),
      prisma.incident.groupBy({
        by: ['severity'],
        where: { departmentId },
        _count: { severity: true },
      }),
      prisma.incident.groupBy({
        by: ['category'],
        where: { departmentId },
        _count: { category: true },
      }),
    ]);

    // Calculate Average Resolution Time in Days (resilient fallback to 0)
    let avgResolutionDays = 0;
    if (closedIncidents.length > 0) {
      const totalDurationMs = closedIncidents.reduce((accum, item) => {
        if (!item.closedAt) return accum;
        return accum + (new Date(item.closedAt).getTime() - new Date(item.createdAt).getTime());
      }, 0);
      avgResolutionDays = parseFloat(
        (totalDurationMs / (closedIncidents.length * 1000 * 60 * 60 * 24)).toFixed(1)
      );
    }

    return {
      summary: {
        totalIncidents: totalCount,
        openTriage: openCount,
        criticalSeverity: criticalCount,
        closedResolved: closedCount,
        avgResolutionDays,
      },
      workflowStages: byStatusRaw.map((item) => ({
        stage: item.status,
        count: item._count.status,
      })),
      severityProfile: bySeverityRaw.map((item) => ({
        severity: item.severity,
        count: item._count.severity,
      })),
      topCategories: byCategoryRaw
        .map((item) => ({
          category: item.category,
          count: item._count.category,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    };
  }

  /**
   * Retrieve Department Personnel and Role Breakdown
   */
  async getTeam(departmentId: number) {
    const users = await prisma.user.findMany({
      where: { departmentId, role: { not: 'ADMIN' } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            investigatedIncidents: true,
            assignedCapaActions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const counts = {
      total: users.length,
      investigators: users.filter((u) => u.role === 'INVESTIGATOR').length,
      actionOwners: users.filter((u) => u.role === 'ACTION_OWNER').length,
      generalStaff: users.filter((u) => u.role === 'STAFF').length,
    };

    return { counts, users };
  }

  /**
   * Delegate/Update Department Staff Role
   */
  async updateTeamRole(departmentId: number, targetUserId: number, newRole: string) {
    const user = await prisma.user.findFirst({
      where: { id: targetUserId, departmentId },
    });

    if (!user) {
      throw new AppError('User not found in your department.', 404);
    }

    if (user.role === 'ADMIN') {
      throw new AppError('Administrative users cannot be re-delegated by departmental managers.', 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: { id: true, name: true, email: true, role: true },
    });

    return updatedUser;
  }

  /**
   * Fetch Complete Clinical Governance Record for an Incident
   */
  async getIncidentDetails(incidentId: number, departmentId: number) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
      include: {
        department: true,
        reporter: { select: { id: true, name: true, email: true } },
        investigator: { select: { id: true, name: true, email: true } },
        actionOwner: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true } },
        attachments: true,
        capaActions: {
          include: {
            actionOwner: { select: { id: true, name: true, email: true } },
            verifiedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        controls: {
          orderBy: { createdAt: 'desc' },
        },
        managementReview: {
          include: {
            reviewedBy: { select: { id: true, name: true } },
          },
        },
        disseminations: {
          orderBy: { scheduledDate: 'asc' },
        },
        auditLogs: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!incident) {
      throw new AppError('Incident not found in your department.', 404);
    }

    return incident;
  }

    /**
   * Stage 1: Triage Decision Gate (Accept, Request Revision, Reject)
   * Enforces status validation, atomic status transition, and clinical audit logging
   */
  async triageIncident(
    incidentId: number,
    departmentId: number,
    managerId: number,
    decision: 'ACCEPT' | 'REVISE' | 'REJECT',
    rationale: string
  ) {
    // 1. Verify incident exists within the manager's authorized department
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
    });

    if (!incident) throw new AppError('Incident not found in your department.', 404);
    
    // 2. Triage can only be executed when incident is in 'OPEN' state
    if (incident.status !== 'OPEN') {
      throw new AppError(`Cannot triage incident in current status: ${incident.status}`, 400);
    }

    // 3. Execute atomic transition and immutable audit logging inside a transaction
    return await prisma.$transaction(async (tx) => {
      let nextStatus = incident.status;
      let rejectionReason: string | null = null;

      if (decision === 'ACCEPT') {
        nextStatus = 'ACCEPTED';
      } else if (decision === 'REJECT') {
        nextStatus = 'REJECTED';
        rejectionReason = rationale;
      } else {
        nextStatus = 'OPEN';
      }

      // Update incident record
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: nextStatus,
          rejectionReason,
        },
      });

      // Write immutable clinical audit record with rationale
      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: `TRIAGE_${decision}`,
          reason: rationale,
          changes: JSON.stringify({ previousStatus: incident.status, newStatus: nextStatus }),
        },
      });

      return updated;
    });
  }

  /**
   * Stage 1: Audited Record Classification Correction
   * Allows manager to rectify misclassified clinical severity or metadata with audit tracking
   */
  async correctRecord(
    incidentId: number,
    departmentId: number,
    managerId: number,
    data: {
      title?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      category?: string;
      location?: string;
      auditReason: string;
    }
  ) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
    });

    if (!incident) throw new AppError('Incident not found in your department.', 404);

    // Track before-and-after differences for audit transparency
    const changesRecorded: Record<string, { from: any; to: any }> = {};
    if (data.title && data.title !== incident.title) {
      changesRecorded.title = { from: incident.title, to: data.title };
    }
    if (data.severity && data.severity !== incident.severity) {
      changesRecorded.severity = { from: incident.severity, to: data.severity };
    }
    if (data.category && data.category !== incident.category) {
      changesRecorded.category = { from: incident.category, to: data.category };
    }
    if (data.location && data.location !== incident.location) {
      changesRecorded.location = { from: incident.location, to: data.location };
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          title: data.title ?? incident.title,
          severity: data.severity ?? incident.severity,
          category: data.category ?? incident.category,
          location: data.location ?? incident.location,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: 'RECORD_CORRECTED',
          reason: data.auditReason,
          changes: JSON.stringify(changesRecorded),
        },
      });

      return updated;
    });
  }

  /**
   * Stage 2: Assign Lead Investigator (Strict Role-Guarded Delegation)
   * Validates investigator role, updates incident state, and initializes structured investigation record
   */
  async assignInvestigator(
    incidentId: number,
    departmentId: number,
    managerId: number,
    investigatorId: number
  ) {
    const [incident, investigator] = await Promise.all([
      prisma.incident.findFirst({ where: { id: incidentId, departmentId } }),
      prisma.user.findFirst({ where: { id: investigatorId, departmentId } }),
    ]);

    if (!incident) throw new AppError('Incident not found in your department.', 404);
    if (!investigator) throw new AppError('Investigator not found in this department.', 404);
    
    // Strict clinical role guard: Only designated INVESTIGATOR role can be assigned
    if (investigator.role !== 'INVESTIGATOR') {
      throw new AppError('Only users with the INVESTIGATOR role can be assigned as Lead Investigator.', 400);
    }

    return await prisma.$transaction(async (tx) => {
      // Progress incident to INVESTIGATING status
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          investigatorId,
          status: 'INVESTIGATING',
          investigationReviewStatus: 'PENDING',
        },
      });

      // Ensure structured Investigation entity exists and is linked
      await tx.investigation.upsert({
        where: { incidentId },
        create: {
          incidentId,
          leadInvestigatorId: investigatorId,
          status: 'DRAFT',
        },
        update: {
          leadInvestigatorId: investigatorId,
        },
      });

      // Immutable audit entry for delegation accountability
      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: 'INVESTIGATOR_ASSIGNED',
          reason: `Assigned Lead Investigator: ${investigator.name} (${investigator.email})`,
        },
      });

      return updated;
    });
  }

  /**
   * Stage 2: Review Submitted Root-Cause Findings
   */
  async reviewInvestigationFindings(
    incidentId: number,
    departmentId: number,
    managerId: number,
    decision: 'APPROVE' | 'REVISE',
    comments: string
  ) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
    });

    if (!incident) throw new AppError('Incident not found in your department.', 404);

    return await prisma.$transaction(async (tx) => {
      const isApproved = decision === 'APPROVE';
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          investigationReviewStatus: isApproved ? 'APPROVED' : 'REVISION_REQUESTED',
          investigationReviewComment: comments,
          // If approved, progress incident to PENDING_ACTION
          status: isApproved ? 'PENDING_ACTION' : 'INVESTIGATING',
        },
      });

      // Synchronize structured Investigation record status
      await tx.investigation.updateMany({
        where: { incidentId },
        data: isApproved
          ? { status: 'APPROVED', approvedAt: new Date(), lockedAt: new Date() }
          : { status: 'REVISION_REQUESTED', lockedAt: null, revisionNumber: { increment: 1 } },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: isApproved ? 'FINDINGS_APPROVED' : 'FINDINGS_REVISION_REQUESTED',
          reason: comments,
        },
      });

      return updated;
    });
  }

  /**
   * Stage 3: Create Corrective/Preventive Action (CAPA)
   */
  async createCapaAction(
    incidentId: number,
    departmentId: number,
    managerId: number,
    data: {
      title: string;
      actionType: 'CORRECTIVE' | 'PREVENTIVE';
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      dueDate: string;
      actionOwnerId: number;
      description: string;
    }
  ) {
    const [incident, owner] = await Promise.all([
      prisma.incident.findFirst({ where: { id: incidentId, departmentId } }),
      prisma.user.findFirst({ where: { id: data.actionOwnerId, departmentId } }),
    ]);

    if (!incident) throw new AppError('Incident not found in your department.', 404);
    if (!owner) throw new AppError('Designated Action Owner not found in this department.', 404);

    return await prisma.$transaction(async (tx) => {
      const action = await tx.capaAction.create({
        data: {
          incidentId,
          title: data.title,
          actionType: data.actionType,
          priority: data.priority,
          dueDate: new Date(data.dueDate),
          actionOwnerId: data.actionOwnerId,
          description: data.description,
          status: 'NOT_STARTED',
        },
      });

      // Synchronize decoupled ActionItem model
      const actionItem = await tx.actionItem.create({
        data: {
          incidentId,
          title: data.title,
          type: data.actionType === 'PREVENTIVE' ? 'PREVENTIVE' : 'CORRECTIVE',
          priority: data.priority,
          dueDate: new Date(data.dueDate),
          ownerId: data.actionOwnerId,
          description: data.description,
          status: 'OPEN',
          reviewStatus: 'ACTIVE',
        },
      });

      await tx.actionHistory.create({
        data: {
          actionItemId: actionItem.id,
          actorId: managerId,
          eventType: 'ASSIGNED',
          toStatus: 'OPEN',
          note: `Assigned to ${owner.name} by Department Manager.`,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: 'CAPA_ACTION_CREATED',
          reason: `Created ${data.actionType} action: "${data.title}" assigned to ${owner.name}`,
        },
      });

      return action;
    });
  }

  /**
   * Stage 3: Manager Two-Person Verification of Completed Action
   */
  async verifyCapaAction(
    incidentId: number,
    actionId: number,
    departmentId: number,
    managerId: number,
    decision: 'VERIFY' | 'REVISE',
    notes?: string
  ) {
    const action = await prisma.capaAction.findFirst({
      where: { id: actionId, incidentId, incident: { departmentId } },
    });

    if (!action) throw new AppError('CAPA action not found for this incident.', 404);

    return await prisma.$transaction(async (tx) => {
      let updatedAction;
      if (decision === 'VERIFY') {
        updatedAction = await tx.capaAction.update({
          where: { id: actionId },
          data: {
            isVerified: true,
            status: 'COMPLETED',
            verifiedAt: new Date(),
            verifiedById: managerId,
            verificationNotes: notes || 'Verified by Department Manager',
          },
        });

        // Sync ActionItem
        const matchedAction = await tx.actionItem.findFirst({
          where: { incidentId, title: action.title },
        });
        if (matchedAction) {
          await tx.actionItem.update({
            where: { id: matchedAction.id },
            data: {
              reviewStatus: 'VERIFIED',
              status: 'COMPLETED',
              completedAt: new Date(),
              managerReviewComment: notes || 'Verified by Department Manager',
              effectiveness: 'EFFECTIVE',
              effectivenessScore: 100,
            },
          });
          await tx.actionHistory.create({
            data: {
              actionItemId: matchedAction.id,
              actorId: managerId,
              eventType: 'VERIFIED',
              fromStatus: matchedAction.status,
              toStatus: 'COMPLETED',
              note: notes || 'Verified by Department Manager',
            },
          });
          await tx.actionNotification.create({
            data: {
              actionItemId: matchedAction.id,
              userId: matchedAction.ownerId,
              type: 'VERIFIED',
              title: 'Action Verified',
              message: `Your action "${matchedAction.title}" has been verified by the Department Manager.`,
            },
          });
        }
      } else {
        updatedAction = await tx.capaAction.update({
          where: { id: actionId },
          data: {
            isVerified: false,
            status: 'IN_PROGRESS',
            verificationNotes: notes || 'Returned for revision by Department Manager',
          },
        });

        // Sync ActionItem
        const matchedAction = await tx.actionItem.findFirst({
          where: { incidentId, title: action.title },
        });
        if (matchedAction) {
          await tx.actionItem.update({
            where: { id: matchedAction.id },
            data: {
              reviewStatus: 'RETURNED_FOR_REVISION',
              status: 'IN_PROGRESS',
              managerReviewComment: notes || 'Returned for revision by Department Manager',
            },
          });
          await tx.actionHistory.create({
            data: {
              actionItemId: matchedAction.id,
              actorId: managerId,
              eventType: 'RETURNED',
              fromStatus: matchedAction.status,
              toStatus: 'IN_PROGRESS',
              note: notes || 'Returned for revision by Department Manager',
            },
          });
          await tx.actionNotification.create({
            data: {
              actionItemId: matchedAction.id,
              userId: matchedAction.ownerId,
              type: 'RETURNED',
              title: 'Action Returned for Revision',
              message: `Revision required: ${notes || 'Returned by Department Manager.'}`,
            },
          });
        }
      }

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: decision === 'VERIFY' ? 'CAPA_ACTION_VERIFIED' : 'CAPA_ACTION_RETURNED',
          reason: notes || `Manager verification evaluation: ${decision}`,
        },
      });

      return updatedAction;
    });
  }

  /**
   * Stage 3: Add Departmental Barrier Control
   */
  async createControl(
    incidentId: number,
    departmentId: number,
    managerId: number,
    data: {
      controlType: string;
      effectiveness: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
      status: 'PLANNED' | 'IN_PROGRESS' | 'VERIFIED';
      failureReason?: string;
      requiredImprovement?: string;
      targetDate: string;
    }
  ) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
    });

    if (!incident) throw new AppError('Incident not found in your department.', 404);

    return await prisma.$transaction(async (tx) => {
      const control = await tx.incidentControl.create({
        data: {
          incidentId,
          controlType: data.controlType,
          effectiveness: data.effectiveness,
          status: data.status,
          failureReason: data.failureReason,
          requiredImprovement: data.requiredImprovement,
          targetDate: new Date(data.targetDate),
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: 'CONTROL_ASSESSED',
          reason: `Logged barrier control "${data.controlType}" with effectiveness: ${data.effectiveness}`,
        },
      });

      return control;
    });
  }

  /**
   * Stage 4: Management Review Sign-off & Lessons Dissemination
   */
  async submitReview(
    incidentId: number,
    departmentId: number,
    managerId: number,
    data: {
      outcome: 'APPROVED' | 'REVISION_REQUIRED';
      lessonsLearned: string;
      outcomeComments: string;
      followUpMonitoring: string;
      dissemination?: {
        audience: string;
        scheduledDate: string;
        status: 'SCHEDULED' | 'COMPLETED';
      };
    }
  ) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
    });

    if (!incident) throw new AppError('Incident not found in your department.', 404);

    return await prisma.$transaction(async (tx) => {
      const review = await tx.managementReview.upsert({
        where: { incidentId },
        create: {
          incidentId,
          outcome: data.outcome,
          lessonsLearned: data.lessonsLearned,
          outcomeComments: data.outcomeComments,
          followUpMonitoring: data.followUpMonitoring,
          reviewedById: managerId,
        },
        update: {
          outcome: data.outcome,
          lessonsLearned: data.lessonsLearned,
          outcomeComments: data.outcomeComments,
          followUpMonitoring: data.followUpMonitoring,
          reviewedById: managerId,
          reviewedAt: new Date(),
        },
      });

      if (data.dissemination) {
        await tx.lessonsDissemination.create({
          data: {
            incidentId,
            audience: data.dissemination.audience,
            scheduledDate: new Date(data.dissemination.scheduledDate),
            status: data.dissemination.status,
          },
        });
      }

      // Update Incident Status to UNDER_REVIEW
      await tx.incident.update({
        where: { id: incidentId },
        data: { status: 'UNDER_REVIEW' },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: 'MANAGEMENT_REVIEW_SUBMITTED',
          reason: `Outcome: ${data.outcome}. Comments: ${data.outcomeComments}`,
        },
      });

      return review;
    });
  }

  /**
   * Stage 4: Controlled Final Closure Gate (The 3 Governance Gates)
   */
  async closeIncident(
    incidentId: number,
    departmentId: number,
    managerId: number,
    closureSummary: string
  ) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, departmentId },
      include: {
        capaActions: true,
        controls: true,
        managementReview: true,
      },
    });

    if (!incident) throw new AppError('Incident not found in your department.', 404);

    // GATE 1: All CAPA Actions must exist, be COMPLETED, and be VERIFIED
    const actions = incident.capaActions;
    if (actions.length === 0) {
      throw new AppError(
        'Closure Gate 1 Failed: At least one CAPA action must be registered and verified before closing.',
        422
      );
    }
    const unverifiedActions = actions.filter((a) => a.status !== 'COMPLETED' || !a.isVerified);
    if (unverifiedActions.length > 0) {
      throw new AppError(
        `Closure Gate 1 Failed: ${unverifiedActions.length} action(s) are either incomplete or pending manager verification.`,
        422
      );
    }

    // GATE 2: All barrier controls must be evaluated and VERIFIED
    const controls = incident.controls;
    if (controls.length === 0) {
      throw new AppError(
        'Closure Gate 2 Failed: Departmental risk controls must be registered and assessed.',
        422
      );
    }
    const unverifiedControls = controls.filter((c) => c.status !== 'VERIFIED');
    if (unverifiedControls.length > 0) {
      throw new AppError(
        `Closure Gate 2 Failed: ${unverifiedControls.length} risk control(s) have not reached 'VERIFIED' status.`,
        422
      );
    }

    // GATE 3: Formal Management Review must exist and be APPROVED
    if (!incident.managementReview || incident.managementReview.outcome !== 'APPROVED') {
      throw new AppError(
        "Closure Gate 3 Failed: Management Review has not been formally approved ('APPROVED' outcome required).",
        422
      );
    }

    // Atomic Execution of Controlled Closure
    return await prisma.$transaction(async (tx) => {
      const closed = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closureSummary,
          closedById: managerId,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: 'INCIDENT_CLOSED',
          reason: `Clinical Governance Gates Verified. Summary: ${closureSummary}`,
        },
      });

      return closed;
    });
  }
}

export const managerService = new ManagerService();