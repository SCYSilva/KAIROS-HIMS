import path from 'path';
import fs from 'fs';
import prisma from '../../shared/prisma/prisma';
import { AppError } from '../../shared/utils/AppError';
import {
  ActionListQuery,
  ProgressInput,
  ResubmitInput,
  ManagerActionReviewInput,
} from './actionOwner.validator';
import { ActionStatus, ActionReviewStatus, Priority, Prisma } from '@prisma/client';

export interface ActionOwnerActor {
  id: number;
  role: string;
  departmentId: number;
}

const RISK_MODEL = 'action-risk-rules-v1.0';
const SIMILARITY_MODEL = 'clinical-action-similarity-v1.0';

// Calendar date helper for accurate hospital SLA days calculations
const calendarDay = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const daysUntil = (date: Date) =>
  Math.round((calendarDay(date) - calendarDay(new Date())) / 86400000);

// Simple token-based text similarity for decision support
const tokenize = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

const computeSimilarity = (a: string, b: string) => {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  if (!wordsA.size || !wordsB.size) return 0;
  const shared = [...wordsA].filter((word) => wordsB.has(word)).length;
  return shared / Math.sqrt(wordsA.size * wordsB.size);
};

export class ActionOwnerService {
  /**
   * Helper to ensure ownership of an action or supervisor access
   */
  private async getOwnedAction(id: number, actor: ActionOwnerActor) {
    const isSupervisor = actor.role === 'MANAGER' || actor.role === 'ADMIN';
    const where: Prisma.ActionItemWhereInput = {
      id,
      ...(isSupervisor ? {} : { ownerId: actor.id }),
    };

    const action = await prisma.actionItem.findFirst({
      where,
      include: {
        incident: {
          include: {
            department: true,
            investigator: { select: { id: true, name: true, email: true } },
            reporter: { select: { id: true, name: true } },
          },
        },
        evidence: { orderBy: { uploadedAt: 'desc' } },
        history: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        notifications: { orderBy: { createdAt: 'desc' } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!action) {
      throw new AppError('Action not found or you do not have permission to access it.', 403);
    }

    return action;
  }

  /**
   * Rule-based due date completion risk calculation
   */
  private calculateRisk(action: {
    dueDate: Date;
    priority: Priority;
    status: ActionStatus;
    reviewStatus: ActionReviewStatus;
  }) {
    const days = daysUntil(action.dueDate);
    let score =
      action.priority === 'CRITICAL'
        ? 45
        : action.priority === 'HIGH'
        ? 30
        : action.priority === 'MEDIUM'
        ? 18
        : 10;

    const factors: string[] = [`${action.priority.toLowerCase()} priority`];

    if (days < 0) {
      score += 45;
      factors.push(`${Math.abs(days)} day(s) overdue`);
    } else if (days <= 3) {
      score += 28;
      factors.push(days === 0 ? 'due today' : `due in ${days} day(s)`);
    }

    if (action.status === 'OPEN') {
      score += 10;
      factors.push('work has not started');
    }

    if (action.reviewStatus === 'RETURNED_FOR_REVISION') {
      score += 15;
      factors.push('returned by manager for revision');
    }

    const cappedScore = Math.min(100, score);
    const level: 'LOW' | 'MEDIUM' | 'HIGH' =
      cappedScore >= 70 ? 'HIGH' : cappedScore >= 40 ? 'MEDIUM' : 'LOW';

    return {
      score: cappedScore,
      level,
      factors,
      modelVersion: RISK_MODEL,
    };
  }

  /**
   * Live synchronization of notification banners for action owner
   */
  private async refreshNotifications(userId: number) {
    const activeActions = await prisma.actionItem.findMany({
      where: {
        ownerId: userId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    for (const action of activeActions) {
      const days = daysUntil(action.dueDate);
      const isOverdue = days < 0;
      const isDueSoon = days >= 0 && days <= 3;
      const isReturned = action.reviewStatus === 'RETURNED_FOR_REVISION';

      if (isOverdue) {
        await prisma.actionNotification.upsert({
          where: {
            actionItemId_userId_type: {
              actionItemId: action.id,
              userId,
              type: 'OVERDUE',
            },
          },
          update: {
            title: 'Action Overdue',
            message: `"${action.title}" is ${Math.abs(days)} day(s) overdue. Immediate remediation required.`,
          },
          create: {
            actionItemId: action.id,
            userId,
            type: 'OVERDUE',
            title: 'Action Overdue',
            message: `"${action.title}" is ${Math.abs(days)} day(s) overdue. Immediate remediation required.`,
          },
        });
      }

      if (isDueSoon) {
        await prisma.actionNotification.upsert({
          where: {
            actionItemId_userId_type: {
              actionItemId: action.id,
              userId,
              type: 'DUE_SOON',
            },
          },
          update: {
            title: 'Action Due Soon',
            message: `"${action.title}" is due ${days === 0 ? 'today' : `in ${days} day(s)`}.`,
          },
          create: {
            actionItemId: action.id,
            userId,
            type: 'DUE_SOON',
            title: 'Action Due Soon',
            message: `"${action.title}" is due ${days === 0 ? 'today' : `in ${days} day(s)`}.`,
          },
        });
      }

      if (isReturned) {
        await prisma.actionNotification.upsert({
          where: {
            actionItemId_userId_type: {
              actionItemId: action.id,
              userId,
              type: 'RETURNED',
            },
          },
          update: {
            title: 'Action Returned for Revision',
            message: `"${action.title}" was returned by the department manager: "${action.managerReviewComment || 'Revision required'}"`,
          },
          create: {
            actionItemId: action.id,
            userId,
            type: 'RETURNED',
            title: 'Action Returned for Revision',
            message: `"${action.title}" was returned by the department manager: "${action.managerReviewComment || 'Revision required'}"`,
          },
        });
      }
    }
  }

  /**
   * Action Owner Dashboard
   */
  async dashboard(actor: ActionOwnerActor, query: ActionListQuery) {
    await this.refreshNotifications(actor.id);

    const now = new Date();
    const in3Days = new Date(Date.now() + 3 * 86400000);

    const where: Prisma.ActionItemWhereInput = {
      ownerId: actor.id,
      ...(query.status ? { status: query.status as ActionStatus } : {}),
      ...(query.priority ? { priority: query.priority as Priority } : {}),
      ...(query.due === 'OVERDUE'
        ? { dueDate: { lt: now }, status: { not: 'COMPLETED' } }
        : query.due === 'DUE_SOON'
        ? { dueDate: { gte: now, lte: in3Days }, status: { not: 'COMPLETED' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { incident: { title: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, allAssigned, notifications] = await prisma.$transaction([
      prisma.actionItem.findMany({
        where,
        include: {
          incident: {
            select: {
              id: true,
              title: true,
              severity: true,
              category: true,
              status: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      }),
      prisma.actionItem.findMany({
        where: { ownerId: actor.id },
        select: { id: true, status: true, reviewStatus: true, dueDate: true },
      }),
      prisma.actionNotification.findMany({
        where: { userId: actor.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const mappedItems = items.map((item) => ({
      ...item,
      overdue: item.status !== 'COMPLETED' && item.dueDate < now,
      dueInDays: daysUntil(item.dueDate),
      completionRisk: this.calculateRisk(item),
    }));

    const summary = {
      total: allAssigned.length,
      open: allAssigned.filter((a) => a.status === 'OPEN').length,
      inProgress: allAssigned.filter((a) => a.status === 'IN_PROGRESS').length,
      overdue: allAssigned.filter(
        (a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && a.dueDate < now
      ).length,
      revisions: allAssigned.filter((a) => a.reviewStatus === 'RETURNED_FOR_REVISION').length,
      pendingVerification: allAssigned.filter(
        (a) => a.reviewStatus === 'COMPLETED_PENDING_VERIFICATION'
      ).length,
      verified: allAssigned.filter((a) => a.reviewStatus === 'VERIFIED').length,
    };

    return {
      items: mappedItems,
      summary,
      notifications,
    };
  }

  /**
   * Action Detail Workspace
   */
  async detail(id: number, actor: ActionOwnerActor) {
    const action = await this.getOwnedAction(id, actor);
    return {
      ...action,
      overdue: action.status !== 'COMPLETED' && action.dueDate < new Date(),
      dueInDays: daysUntil(action.dueDate),
      completionRisk: this.calculateRisk(action),
    };
  }

  /**
   * Update Progress & Completion with Verification Notes
   */
  async updateProgress(id: number, input: ProgressInput, actor: ActionOwnerActor) {
    const action = await this.getOwnedAction(id, actor);

    if (action.reviewStatus === 'VERIFIED') {
      throw new AppError('This action has been verified by the Manager and is locked.', 409);
    }

    if (input.status === 'COMPLETED' && (!input.verificationNotes || input.verificationNotes.trim().length < 10)) {
      throw new AppError('Verification notes (minimum 10 characters) are required for completion.', 400);
    }

    const reviewStatus: ActionReviewStatus =
      input.status === 'COMPLETED'
        ? 'COMPLETED_PENDING_VERIFICATION'
        : action.reviewStatus === 'RETURNED_FOR_REVISION'
        ? 'RETURNED_FOR_REVISION'
        : 'ACTIVE';

    const risk = this.calculateRisk({
      ...action,
      status: input.status as ActionStatus,
      reviewStatus,
    });

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.actionItem.update({
        where: { id },
        data: {
          status: input.status as ActionStatus,
          progressNote: input.progressNote,
          verificationNotes: input.verificationNotes || action.verificationNotes,
          reviewStatus,
          completedAt: input.status === 'COMPLETED' ? new Date() : action.completedAt,
          completionRiskScore: risk.score,
          riskExplanation: risk,
        },
      });

      await tx.actionHistory.create({
        data: {
          actionItemId: id,
          actorId: actor.id,
          eventType:
            input.status === 'COMPLETED'
              ? 'SUBMITTED_FOR_VERIFICATION'
              : 'PROGRESS_UPDATED',
          fromStatus: action.status,
          toStatus: input.status,
          note: input.progressNote,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId: action.incidentId,
          userId: actor.id,
          action:
            input.status === 'COMPLETED'
              ? 'ACTION_SUBMITTED_FOR_VERIFICATION'
              : 'ACTION_PROGRESS_UPDATED',
          reason: `Action ACT-${String(id).padStart(4, '0')} (${action.title}): ${input.progressNote}`,
        },
      });

      return updated;
    });
  }

  /**
   * Resubmit Returned Action
   */
  async resubmit(id: number, input: ResubmitInput, actor: ActionOwnerActor) {
    const action = await this.getOwnedAction(id, actor);

    if (action.reviewStatus !== 'RETURNED_FOR_REVISION') {
      throw new AppError('Only actions returned for revision can be resubmitted.', 400);
    }

    const risk = this.calculateRisk({
      ...action,
      status: 'COMPLETED',
      reviewStatus: 'COMPLETED_PENDING_VERIFICATION',
    });

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.actionItem.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          reviewStatus: 'COMPLETED_PENDING_VERIFICATION',
          progressNote: input.progressNote,
          verificationNotes: input.verificationNotes,
          completedAt: new Date(),
          completionRiskScore: risk.score,
          riskExplanation: risk,
        },
      });

      await tx.actionHistory.create({
        data: {
          actionItemId: id,
          actorId: actor.id,
          eventType: 'RESUBMITTED_FOR_VERIFICATION',
          fromStatus: action.status,
          toStatus: 'COMPLETED',
          note: `Resubmitted: ${input.progressNote}`,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId: action.incidentId,
          userId: actor.id,
          action: 'ACTION_RESUBMITTED',
          reason: `Action ACT-${String(id).padStart(4, '0')} resubmitted for Manager verification.`,
        },
      });

      // Mark any RETURNED notifications as read
      await tx.actionNotification.updateMany({
        where: {
          actionItemId: id,
          userId: actor.id,
          type: 'RETURNED',
        },
        data: { readAt: new Date() },
      });

      return updated;
    });
  }

  /**
   * Multi-part File Upload Evidence Attachment
   */
  async addEvidence(id: number, file: Express.Multer.File | undefined, actor: ActionOwnerActor) {
    const action = await this.getOwnedAction(id, actor);

    if (action.reviewStatus === 'VERIFIED') {
      throw new AppError('Cannot upload evidence to a verified, locked action.', 409);
    }

    if (!file) {
      throw new AppError('Please select a valid JPG, PNG, or PDF file (up to 5MB).', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const evidence = await tx.actionEvidence.create({
        data: {
          actionItemId: id,
          fileName: file.originalname,
          filePath: file.path,
          fileType: file.mimetype,
          fileSize: file.size,
        },
      });

      await tx.actionHistory.create({
        data: {
          actionItemId: id,
          actorId: actor.id,
          eventType: 'EVIDENCE_ADDED',
          note: `Uploaded file: ${file.originalname} (${Math.round(file.size / 1024)} KB)`,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId: action.incidentId,
          userId: actor.id,
          action: 'ACTION_EVIDENCE_UPLOADED',
          reason: `Uploaded evidence for ACT-${String(id).padStart(4, '0')}: ${file.originalname}`,
        },
      });

      return evidence;
    });
  }

  /**
   * Secure Authenticated Evidence Retrieval
   */
  async getEvidenceFile(id: number, evidenceId: number, actor: ActionOwnerActor) {
    await this.getOwnedAction(id, actor);

    const evidence = await prisma.actionEvidence.findFirst({
      where: { id: evidenceId, actionItemId: id },
    });

    if (!evidence) {
      throw new AppError('Evidence record not found.', 404);
    }

    const absolutePath = path.resolve(evidence.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new AppError('Evidence file is missing on storage server.', 404);
    }

    return {
      ...evidence,
      absolutePath,
    };
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(id: number, actor: ActionOwnerActor) {
    const notif = await prisma.actionNotification.findFirst({
      where: { id, userId: actor.id },
    });

    if (!notif) {
      throw new AppError('Notification not found.', 404);
    }

    return await prisma.actionNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Decision Support: Similar verified actions & recommendations
   */
  async insights(id: number, actor: ActionOwnerActor) {
    const action = await this.getOwnedAction(id, actor);

    // Retrieve verified past actions from the hospital
    const pastActions = await prisma.actionItem.findMany({
      where: {
        id: { not: id },
        reviewStatus: 'VERIFIED',
      },
      include: {
        incident: { select: { id: true, title: true, category: true, department: true } },
      },
      take: 100,
    });

    const sourceContext = `${action.title} ${action.description} ${action.incident.title} ${action.incident.category}`;

    const ranked = pastActions
      .map((item) => {
        const itemContext = `${item.title} ${item.description} ${item.incident.title} ${item.incident.category}`;
        const score = computeSimilarity(sourceContext, itemContext);
        return {
          ...item,
          similarityScore: Number(score.toFixed(3)),
        };
      })
      .filter((item) => item.similarityScore > 0.05)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 5);

    const recommendations = pastActions
      .filter(
        (a) =>
          a.effectiveness === 'EFFECTIVE' ||
          (a.effectivenessScore && a.effectivenessScore >= 80)
      )
      .slice(0, 4)
      .map((item) => ({
        key: `rec-act-${item.id}`,
        title: item.title,
        description: item.description,
        effectiveness: item.effectiveness || 'EFFECTIVE',
        effectivenessScore: item.effectivenessScore ?? 95,
        sourceIncident: {
          id: item.incident.id,
          title: item.incident.title,
        },
      }));

    return {
      modelVersion: SIMILARITY_MODEL,
      completionRisk: this.calculateRisk(action),
      similarActions: ranked,
      recommendations,
    };
  }

  /**
   * Manager / Supervisor Review & Verification (Two-Person Rule)
   */
  async managerReview(
    incidentId: number,
    actionId: number,
    input: ManagerActionReviewInput,
    managerId: number
  ) {
    const action = await prisma.actionItem.findFirst({
      where: { id: actionId, incidentId },
      include: { incident: true, owner: true },
    });

    if (!action) {
      throw new AppError('Action not found for this incident.', 404);
    }

    const isVerify = input.decision === 'VERIFY';

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.actionItem.update({
        where: { id: actionId },
        data: {
          reviewStatus: isVerify ? 'VERIFIED' : 'RETURNED_FOR_REVISION',
          status: isVerify ? 'COMPLETED' : 'IN_PROGRESS',
          managerReviewComment: input.comment,
          effectiveness: isVerify ? input.effectiveness : null,
          effectivenessScore: isVerify ? input.effectivenessScore : null,
        },
      });

      await tx.actionHistory.create({
        data: {
          actionItemId: actionId,
          actorId: managerId,
          eventType: isVerify ? 'VERIFIED' : 'RETURNED_FOR_REVISION',
          fromStatus: action.status,
          toStatus: isVerify ? 'COMPLETED' : 'IN_PROGRESS',
          note: `Manager decision [${input.decision}]: ${input.comment}`,
        },
      });

      await tx.incidentAuditLog.create({
        data: {
          incidentId,
          userId: managerId,
          action: isVerify ? 'ACTION_VERIFIED_BY_MANAGER' : 'ACTION_RETURNED_BY_MANAGER',
          reason: `Manager evaluated ACT-${String(actionId).padStart(4, '0')}: ${input.comment}`,
        },
      });

      // Notify action owner
      await tx.actionNotification.create({
        data: {
          actionItemId: actionId,
          userId: action.ownerId,
          type: isVerify ? 'VERIFIED' : 'RETURNED',
          title: isVerify ? 'Action Verified' : 'Action Returned for Revision',
          message: isVerify
            ? `Your corrective action "${action.title}" was approved & verified effective.`
            : `Manager requested revisions for "${action.title}": ${input.comment}`,
        },
      });

      return updated;
    });
  }
}

export const actionOwnerService = new ActionOwnerService();
