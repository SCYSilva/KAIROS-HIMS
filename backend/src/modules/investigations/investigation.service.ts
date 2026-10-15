import { InvestigationMethod, InvestigationStatus, Prisma, Severity } from '@prisma/client';
import prisma from '../../shared/prisma/prisma';
import { AppError } from '../../shared/utils/AppError';

export interface InvestigationActor {
  id: number;
  role: string;
  departmentId: number;
  ipAddress?: string;
}

const workspaceInclude = {
  incident: {
    include: {
      department: true,
      reporter: { select: { id: true, name: true, email: true } },
      attachments: true,
    },
  },
  leadInvestigator: { select: { id: true, name: true, email: true } },
  teamMembers: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  contributingFactors: { orderBy: { createdAt: 'asc' as const } },
  witnesses: { orderBy: { createdAt: 'asc' as const } },
  timeline: { orderBy: { occurredAt: 'asc' as const } },
  evidence: { orderBy: { createdAt: 'asc' as const } },
  aiFeedback: { orderBy: { createdAt: 'desc' as const }, take: 30 },
} satisfies Prisma.InvestigationInclude;

const textEmbedding = (value: string, dimensions = 64) => {
  const vector = Array.from({ length: dimensions }, () => 0);
  value.toLowerCase().match(/[a-z0-9]+/g)?.forEach((token) => {
    let hash = 2166136261;
    for (const character of token) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    vector[Math.abs(hash) % dimensions] += hash % 2 === 0 ? 1 : -1;
  });
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1;
  return vector.map((item) => item / magnitude);
};

const cosineSimilarity = (left: number[], right: number[]) =>
  left.reduce((sum, item, index) => sum + item * (right[index] ?? 0), 0);

export class InvestigationService {
  private assertOwner(incident: { investigatorId: number | null }, actor: InvestigationActor) {
    if (actor.role !== 'ADMIN' && incident.investigatorId !== actor.id) {
      throw new AppError('Access forbidden: You can only access investigations assigned to you.', 403);
    }
  }

  private async incidentOwned(incidentId: number, actor: InvestigationActor) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { investigationRecord: true },
    });
    if (!incident) throw new AppError('Incident record not found.', 404);
    this.assertOwner(incident, actor);
    return incident;
  }

  private assertEditable(status: InvestigationStatus) {
    if (['SUBMITTED', 'APPROVED'].includes(status)) {
      throw new AppError(
        'Investigation findings are currently locked and read-only. Editing is disabled until returned by Manager.',
        409
      );
    }
  }

  private async audit(
    actor: InvestigationActor,
    action: string,
    incidentId: number,
    changes?: unknown,
    reason?: string
  ) {
    await prisma.incidentAuditLog
      .create({
        data: {
          incidentId,
          userId: actor.id,
          action,
          reason: reason || undefined,
          changes: changes ? JSON.stringify(changes) : undefined,
        },
      })
      .catch(() => {});
  }

  private async ensureRecord(incidentId: number, actor: InvestigationActor) {
    const incident = await this.incidentOwned(incidentId, actor);
    if (!incident.investigatorId) {
      throw new AppError('No lead Investigator is assigned to this incident.', 409);
    }
    if (!['INVESTIGATING', 'PENDING_ACTION', 'UNDER_REVIEW', 'CLOSED'].includes(incident.status)) {
      throw new AppError('Investigation has not been initiated for this incident status.', 409);
    }

    return prisma.investigation.upsert({
      where: { incidentId },
      create: { incidentId, leadInvestigatorId: incident.investigatorId, status: 'DRAFT' },
      update: { leadInvestigatorId: incident.investigatorId },
      include: workspaceInclude,
    });
  }

  async getAssignedIncidents(investigatorId: number) {
    if (!investigatorId) throw new AppError('Invalid Investigator ID.', 400);
    return prisma.incident.findMany({
      where: {
        investigatorId,
        status: { in: ['INVESTIGATING', 'UNDER_REVIEW', 'PENDING_ACTION'] },
      },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dashboard(
    actor: InvestigationActor,
    query: { search?: string; status?: InvestigationStatus; severity?: Severity; due?: string }
  ) {
    // Self-healing: ensure any incidents assigned to this investigator have an investigation record initialized
    const assignedIncidents = await prisma.incident.findMany({
      where: {
        investigatorId: actor.id,
        status: { in: ['INVESTIGATING', 'PENDING_ACTION', 'UNDER_REVIEW', 'CLOSED'] },
      },
      select: { id: true, investigatorId: true, investigationRecord: { select: { id: true, leadInvestigatorId: true } } },
    });

    for (const inc of assignedIncidents) {
      if (!inc.investigationRecord) {
        await prisma.investigation
          .create({
            data: { incidentId: inc.id, leadInvestigatorId: actor.id, status: 'DRAFT' },
          })
          .catch(() => {});
      } else if (inc.investigationRecord.leadInvestigatorId !== actor.id) {
        await prisma.investigation
          .update({
            where: { incidentId: inc.id },
            data: { leadInvestigatorId: actor.id },
          })
          .catch(() => {});
      }
    }

    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86400000);

    const records = await prisma.investigation.findMany({
      where: {
        leadInvestigatorId: actor.id,
        status: query.status,
        endDate:
          query.due === 'OVERDUE'
            ? { lt: now }
            : query.due === 'NEXT_7_DAYS'
            ? { gte: now, lte: inSevenDays }
            : query.due === 'NO_DATE'
            ? null
            : undefined,
        incident: {
          severity: query.severity,
          OR: query.search
            ? [
                { title: { contains: query.search, mode: 'insensitive' } },
                { category: { contains: query.search, mode: 'insensitive' } },
                { location: { contains: query.search, mode: 'insensitive' } },
              ]
            : undefined,
        },
      },
      include: {
        incident: { include: { department: true } },
        _count: {
          select: {
            teamMembers: true,
            evidence: true,
            timeline: true,
            contributingFactors: true,
          },
        },
      },
      orderBy: [{ endDate: 'asc' }, { updatedAt: 'desc' }],
    });

    const rank: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

    return {
      summary: {
        total: records.length,
        drafts: records.filter((x) => x.status === 'DRAFT').length,
        revision: records.filter((x) => x.status === 'REVISION_REQUESTED').length,
        submitted: records.filter((x) => x.status === 'SUBMITTED').length,
        overdue: records.filter(
          (x) => x.endDate && x.endDate < now && !['APPROVED', 'SUBMITTED'].includes(x.status)
        ).length,
      },
      items: records.map((x) => ({
        ...x,
        priority: rank[x.incident.severity],
        overdue: Boolean(x.endDate && x.endDate < now && !['APPROVED', 'SUBMITTED'].includes(x.status)),
      })),
    };
  }

  async workspace(incidentId: number, actor: InvestigationActor) {
    return this.ensureRecord(incidentId, actor);
  }

  async candidates(incidentId: number, actor: InvestigationActor) {
    const incident = await this.incidentOwned(incidentId, actor);
    return prisma.user.findMany({
      where: {
        departmentId: incident.departmentId,
        role: { in: ['INVESTIGATOR', 'STAFF'] },
        id: { not: actor.id },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async saveDraft(incidentId: number, input: any, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    const { contributingFactors, ...fields } = input;

    await prisma.$transaction(async (tx) => {
      await tx.investigation.update({
        where: { incidentId },
        data: {
          ...fields,
          status: record.status === 'REVISION_REQUESTED' ? 'REVISION_REQUESTED' : 'DRAFT',
        },
      });

      if (contributingFactors !== undefined) {
        await tx.investigationFactor.deleteMany({
          where: { investigationId: record.id },
        });

        if (Array.isArray(contributingFactors) && contributingFactors.length > 0) {
          await tx.investigationFactor.createMany({
            data: contributingFactors.map((factor: any) => ({
              investigationId: record.id,
              category: String(factor.category || '').trim(),
              description: String(factor.description || '').trim(),
            })),
          });
        }
      }
    });

    await this.audit(actor, 'SAVE_INVESTIGATION_DRAFT', incidentId, {
      status: record.status,
      fieldsUpdated: Object.keys(fields),
    });

    return this.ensureRecord(incidentId, actor);
  }

  async addTeamMember(
    incidentId: number,
    input: { userId: number; role: string },
    actor: InvestigationActor
  ) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    const user = await prisma.user.findFirst({
      where: {
        id: input.userId,
        departmentId: record.incident.departmentId,
        role: { in: ['INVESTIGATOR', 'STAFF'] },
      },
    });

    if (!user) {
      throw new AppError('Candidate must be an active user in the incident department.', 400);
    }

    const member = await prisma.investigationTeamMember.upsert({
      where: {
        investigationId_userId: {
          investigationId: record.id,
          userId: input.userId,
        },
      },
      create: {
        investigationId: record.id,
        userId: input.userId,
        role: input.role,
      },
      update: {
        role: input.role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await this.audit(actor, 'ADD_INVESTIGATION_TEAM_MEMBER', incidentId, {
      userId: input.userId,
      role: input.role,
    });

    return member;
  }

  async removeTeamMember(incidentId: number, userId: number, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    await prisma.investigationTeamMember.deleteMany({
      where: {
        investigationId: record.id,
        userId,
      },
    });

    await this.audit(actor, 'REMOVE_INVESTIGATION_TEAM_MEMBER', incidentId, { userId });
  }

  async addWitness(incidentId: number, input: any, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    const witness = await prisma.investigationWitness.create({
      data: {
        investigationId: record.id,
        name: input.name,
        roleOrContact: input.roleOrContact || null,
        statement: input.statement || null,
        interviewedAt: input.interviewedAt ? new Date(input.interviewedAt) : null,
      },
    });

    await this.audit(actor, 'ADD_INVESTIGATION_WITNESS', incidentId, { witnessId: witness.id });
    return witness;
  }

  async addTimeline(incidentId: number, input: any, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    const event = await prisma.investigationTimelineEvent.create({
      data: {
        investigationId: record.id,
        occurredAt: new Date(input.occurredAt),
        title: input.title,
        description: input.description,
        source: input.source || null,
      },
    });

    await this.audit(actor, 'ADD_INVESTIGATION_TIMELINE_EVENT', incidentId, { timelineId: event.id });
    return event;
  }

  async addEvidence(incidentId: number, input: any, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    if (
      input.attachmentId &&
      !record.incident.attachments.some((file) => file.id === input.attachmentId)
    ) {
      throw new AppError('Evidence attachment is not authorized for this incident.', 403);
    }

    const item = await prisma.investigationEvidence.create({
      data: {
        investigationId: record.id,
        attachmentId: input.attachmentId || null,
        label: input.label,
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });

    await this.audit(actor, 'ADD_INVESTIGATION_EVIDENCE', incidentId, { evidenceId: item.id });
    return item;
  }

  async linkIncident(
    incidentId: number,
    input: { targetIncidentId: number; reason: string },
    actor: InvestigationActor
  ) {
    await this.ensureRecord(incidentId, actor);
    const target = await prisma.incident.findFirst({
      where: { id: input.targetIncidentId, investigatorId: actor.id },
    });

    if (!target) {
      throw new AppError('You may only link other incidents assigned to you.', 403);
    }
    if (target.id === incidentId) {
      throw new AppError('An incident cannot link to itself.', 400);
    }

    const link = await prisma.incidentRelationship.upsert({
      where: {
        sourceIncidentId_targetIncidentId: {
          sourceIncidentId: incidentId,
          targetIncidentId: target.id,
        },
      },
      create: {
        sourceIncidentId: incidentId,
        targetIncidentId: target.id,
        reason: input.reason,
      },
      update: {
        reason: input.reason,
      },
    });

    await this.audit(actor, 'LINK_RELATED_INCIDENT', incidentId, undefined, input.reason);
    return link;
  }

  async submit(incidentId: number, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    this.assertEditable(record.status);

    const missing = [
      !record.startDate && 'Start date',
      !record.method && 'Investigation method',
      !record.findingsSummary?.trim() && 'Findings summary narrative',
      record.contributingFactors.length === 0 && 'At least 1 contributing factor',
      !record.rootCauseCategory?.trim() && 'Root-cause category',
      !record.rootCauseSubcategory?.trim() && 'Root-cause sub-category',
      !record.rootCauseDescription?.trim() && 'Root-cause statement',
      !record.rootCauseMethod && 'Root-cause analysis method',
      !record.rootCauseDetail?.trim() && 'Detailed analysis reasoning',
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new AppError(
        `Cannot submit investigation. Complete required clinical fields: ${missing.join(', ')}.`,
        400
      );
    }

    const now = new Date();
    const isRevision = record.status === 'REVISION_REQUESTED';

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.investigation.update({
        where: { id: record.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: now,
          endDate: record.endDate ?? now,
          lockedAt: now,
        },
      });

      // Transfer governance to Manager review
      await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: 'UNDER_REVIEW',
          rootCause: record.rootCauseDescription,
          rootCauseCategory: record.rootCauseCategory,
          investigationFindings: record.findingsSummary,
          investigationReviewStatus: 'SUBMITTED',
          investigationReviewComment: null,
        },
      });

      return result;
    });

    await this.audit(
      actor,
      isRevision ? 'RESUBMIT_INVESTIGATION_FINDINGS' : 'SUBMIT_INVESTIGATION_FINDINGS',
      incidentId,
      { before: record.status, after: 'SUBMITTED' }
    );

    return updated;
  }

  async decisionSupport(incidentId: number, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);

    const candidates = await prisma.incident.findMany({
      where: { id: { not: incidentId }, investigatorId: actor.id },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        location: true,
        severity: true,
        rootCauseCategory: true,
        rootCause: true,
        investigationRecord: { select: { method: true, rootCauseSubcategory: true } },
      },
      take: 25,
      orderBy: { updatedAt: 'desc' },
    });

    const queryEmbedding = textEmbedding(
      [
        record.incident.title,
        record.incident.description,
        record.incident.category,
        record.incident.location,
        record.rootCauseDescription ?? '',
      ].join(' ')
    );

    const scored = candidates
      .map((item) => {
        const matches = [
          item.category === record.incident.category && 'Category match',
          item.location === record.incident.location && 'Location match',
          item.severity === record.incident.severity && 'Severity parity',
          item.rootCauseCategory &&
            item.rootCauseCategory === record.rootCauseCategory &&
            'RCA category match',
        ].filter(Boolean) as string[];

        const candidateEmbedding = textEmbedding(
          [item.title, item.description, item.category, item.location, item.rootCause ?? ''].join(' ')
        );
        const textScore = Math.max(0, cosineSimilarity(queryEmbedding, candidateEmbedding));
        return {
          ...item,
          matchedFields: matches,
          similarity: Math.min(0.99, textScore * 0.7 + (matches.length / 4) * 0.3),
        };
      })
      .filter((x) => x.similarity >= 0.15)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8);

    const methodSuggestions: Array<{ method: InvestigationMethod; reason: string }> =
      record.incident.category.toLowerCase().includes('equipment')
        ? [
            {
              method: 'FAULT_TREE',
              reason: 'Equipment and mechanical failures benefit from deductive logic trees.',
            },
            {
              method: 'FISHBONE',
              reason: 'Evaluates interaction between device maintenance, operator, and environmental factors.',
            },
          ]
        : [
            {
              method: 'FIVE_WHYS',
              reason: 'Standard clinical technique for establishing sequential cause-and-effect chains.',
            },
            {
              method: 'FISHBONE',
              reason: 'Recommended for multi-factorial clinical events involving process, people, and environment.',
            },
          ];

    const clusters = Object.values(
      candidates.reduce((map: Record<string, any>, item) => {
        const key = `${item.category} • ${item.location}`;
        map[key] ??= { name: key, count: 0, incidentIds: [] };
        map[key].count += 1;
        map[key].incidentIds.push(item.id);
        return map;
      }, {})
    )
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 8);

    const timelineSummary = record.timeline.length
      ? `${record.timeline.length} chronological events logged from ${new Date(
          record.timeline[0].occurredAt
        ).toLocaleDateString()} to ${new Date(
          record.timeline[record.timeline.length - 1].occurredAt
        ).toLocaleDateString()}.`
      : 'No timeline events recorded yet. Chronological sequencing improves clinical RCA accuracy.';

    const evidenceSummary = `${record.incident.attachments.length} uploaded incident files and ${record.evidence.length} structured references logged. Ensure clinical source verification before final submission.`;

    return {
      modelVersion: 'clinical-decision-support-v1.0',
      disclaimer:
        'Auditable clinical governance assistance. Findings remain the professional responsibility of the Lead Investigator.',
      similarIncidents: scored,
      clusters,
      methodSuggestions,
      summaries: { timeline: timelineSummary, evidence: evidenceSummary },
    };
  }

  async recordAiFeedback(incidentId: number, input: any, actor: InvestigationActor) {
    const record = await this.ensureRecord(incidentId, actor);
    const feedback = await prisma.investigationAiFeedback.create({
      data: {
        investigationId: record.id,
        feature: input.feature,
        resultKey: input.resultKey,
        action: input.action,
        reason: input.reason || null,
        modelVersion: input.modelVersion,
      },
    });

    await this.audit(actor, 'DECISION_SUPPORT_FEEDBACK', incidentId, feedback);
    return feedback;
  }

  async submitRootCauseLegacy(
    incidentId: number,
    rootCause: string,
    rootCauseCategory: string,
    actor: InvestigationActor
  ) {
    await this.ensureRecord(incidentId, actor);
    await this.saveDraft(
      incidentId,
      {
        findingsSummary: rootCause,
        rootCauseDescription: rootCause,
        rootCauseDetail: rootCause,
        rootCauseCategory,
        rootCauseSubcategory: 'Clinical General',
        rootCauseMethod: 'FIVE_WHYS',
        method: 'FIVE_WHYS',
        startDate: new Date(),
        contributingFactors: [
          {
            category: 'Legacy Submission',
            description: 'Captured via standard root cause quick submission.',
          },
        ],
      },
      actor
    );
    return this.submit(incidentId, actor);
  }
}

export const investigationService = new InvestigationService();
