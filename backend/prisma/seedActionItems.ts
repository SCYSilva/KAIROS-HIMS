import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedActionItems() {
  console.log('Seeding clinical Action Items...');

  const actionOwner = await prisma.user.findFirst({
    where: { role: 'ACTION_OWNER' },
  });

  const manager = await prisma.user.findFirst({
    where: { role: 'MANAGER' },
  });

  if (!actionOwner || !manager) {
    console.error('Action Owner or Manager user not found in database.');
    return;
  }

  const incidents = await prisma.incident.findMany({
    take: 10,
    orderBy: { id: 'asc' },
  });

  if (incidents.length === 0) {
    console.error('No incidents found to attach action items.');
    return;
  }

  // Clear existing action items to prevent duplication
  await prisma.actionEvidence.deleteMany({});
  await prisma.actionHistory.deleteMany({});
  await prisma.actionNotification.deleteMany({});
  await prisma.actionItem.deleteMany({});

  const now = new Date();
  const past3Days = new Date(Date.now() - 3 * 86400000);
  const future2Days = new Date(Date.now() + 2 * 86400000);
  const future7Days = new Date(Date.now() + 7 * 86400000);
  const future14Days = new Date(Date.now() + 14 * 86400000);

  // 1. Overdue Item (High/Critical risk)
  const act1 = await prisma.actionItem.create({
    data: {
      incidentId: incidents[0].id,
      ownerId: actionOwner.id,
      title: 'Biomedical emergency calibration of ECG telemetry unit',
      description: 'Conduct electrical isolation check and certified technician calibration test on ECG Unit 4B following intermittent signal dropout.',
      type: 'CORRECTIVE',
      priority: 'CRITICAL',
      dueDate: past3Days,
      status: 'OPEN',
      reviewStatus: 'ACTIVE',
      completionRiskScore: 90,
      riskExplanation: { score: 90, level: 'HIGH', factors: ['critical priority', '3 day(s) overdue', 'work has not started'], modelVersion: 'action-risk-rules-v1.0' },
    },
  });

  await prisma.actionHistory.create({
    data: {
      actionItemId: act1.id,
      actorId: manager.id,
      eventType: 'ASSIGNED',
      toStatus: 'OPEN',
      note: 'Assigned as high-priority CAPA item following equipment failure review.',
    },
  });

  // 2. Revision Required Item (Returned by Manager)
  const act2 = await prisma.actionItem.create({
    data: {
      incidentId: incidents[1] ? incidents[1].id : incidents[0].id,
      ownerId: actionOwner.id,
      title: 'Pharmacy high-alert anticoagulant dual-signoff protocol',
      description: 'Implement mandatory digital barcode cross-matching and dual registered nurse verification before IV infusion of high-potency heparin.',
      type: 'PREVENTIVE',
      priority: 'HIGH',
      dueDate: future2Days,
      status: 'IN_PROGRESS',
      reviewStatus: 'RETURNED_FOR_REVISION',
      progressNote: 'Initial draft policy was circulated among senior staff nurses.',
      managerReviewComment: 'Clinical pharmacy audit showed 2 shift rotations were missed during briefing. Need sign-off sheets from all 3 shifts before verification.',
      completionRiskScore: 73,
      riskExplanation: { score: 73, level: 'HIGH', factors: ['high priority', 'due in 2 day(s)', 'returned by manager for revision'], modelVersion: 'action-risk-rules-v1.0' },
    },
  });

  await prisma.actionHistory.createMany({
    data: [
      {
        actionItemId: act2.id,
        actorId: manager.id,
        eventType: 'ASSIGNED',
        toStatus: 'OPEN',
        note: 'Assigned as systemic preventive measure.',
      },
      {
        actionItemId: act2.id,
        actorId: actionOwner.id,
        eventType: 'PROGRESS_UPDATED',
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        note: 'Initial draft policy was circulated among senior staff nurses.',
      },
      {
        actionItemId: act2.id,
        actorId: manager.id,
        eventType: 'RETURNED_FOR_REVISION',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'IN_PROGRESS',
        note: 'Clinical pharmacy audit showed 2 shift rotations were missed during briefing. Need sign-off sheets from all 3 shifts before verification.',
      },
    ],
  });

  // 3. Awaiting Verification Item
  const act3 = await prisma.actionItem.create({
    data: {
      incidentId: incidents[2] ? incidents[2].id : incidents[0].id,
      ownerId: actionOwner.id,
      title: 'Facility anti-slip safety coating and drainage remediation in Ward 2',
      description: 'Contract professional slip-resistance treatment on terrazzo corridor flooring and repair leaking plumbing valve under sink station.',
      type: 'CORRECTIVE',
      priority: 'MEDIUM',
      dueDate: future7Days,
      status: 'COMPLETED',
      reviewStatus: 'COMPLETED_PENDING_VERIFICATION',
      progressNote: 'Completed plumbing valve replacement and applied polymer non-slip sealant across the full corridor corridor length.',
      verificationNotes: 'Certified slip coefficient certificate (>0.60 wet pendulum test) obtained from facility engineers. Photographic evidence uploaded.',
      completedAt: new Date(),
      completionRiskScore: 18,
      riskExplanation: { score: 18, level: 'LOW', factors: ['medium priority'], modelVersion: 'action-risk-rules-v1.0' },
    },
  });

  await prisma.actionHistory.createMany({
    data: [
      {
        actionItemId: act3.id,
        actorId: manager.id,
        eventType: 'ASSIGNED',
        toStatus: 'OPEN',
        note: 'Assigned following slip and fall hazard incident.',
      },
      {
        actionItemId: act3.id,
        actorId: actionOwner.id,
        eventType: 'PROGRESS_UPDATED',
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        note: 'Plumbing contractor on-site replacing defective valve.',
      },
      {
        actionItemId: act3.id,
        actorId: actionOwner.id,
        eventType: 'SUBMITTED_FOR_VERIFICATION',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'COMPLETED',
        note: 'Work completed. Submitting certification documents for Manager verification.',
      },
    ],
  });

  // 4. Verified Effective Past Action (For Decision Support & KPI)
  const act4 = await prisma.actionItem.create({
    data: {
      incidentId: incidents[3] ? incidents[3].id : incidents[0].id,
      ownerId: actionOwner.id,
      title: 'Deployment of ultra-low profile hospital beds with smart pressure sensors',
      description: 'Procured 12 height-adjustable beds with automatic bedside sensor alarms for high fall-risk cardiology ward patients.',
      type: 'PREVENTIVE',
      priority: 'HIGH',
      dueDate: past3Days,
      status: 'COMPLETED',
      reviewStatus: 'VERIFIED',
      progressNote: 'Installed 12 smart sensor beds and trained 28 floor nurses on threshold settings.',
      verificationNotes: '30-day post-intervention clinical governance audit confirmed 0 unassisted patient fall events.',
      completedAt: new Date(Date.now() - 10 * 86400000),
      managerReviewComment: 'Clinical governance committee validated 30-day data. High effectiveness confirmed.',
      effectiveness: 'EFFECTIVE',
      effectivenessScore: 96,
      completionRiskScore: 10,
      riskExplanation: { score: 10, level: 'LOW', factors: ['verified complete'], modelVersion: 'action-risk-rules-v1.0' },
    },
  });

  await prisma.actionHistory.createMany({
    data: [
      {
        actionItemId: act4.id,
        actorId: manager.id,
        eventType: 'ASSIGNED',
        toStatus: 'OPEN',
        note: 'Assigned capital equipment procurement & implementation.',
      },
      {
        actionItemId: act4.id,
        actorId: actionOwner.id,
        eventType: 'SUBMITTED_FOR_VERIFICATION',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'COMPLETED',
        note: 'Installation complete, 30-day audit log attached.',
      },
      {
        actionItemId: act4.id,
        actorId: manager.id,
        eventType: 'VERIFIED',
        fromStatus: 'COMPLETED',
        toStatus: 'COMPLETED',
        note: 'Validated by Department Manager. Effectiveness rated 96%.',
      },
    ],
  });

  // 5. In-Progress Item
  const act5 = await prisma.actionItem.create({
    data: {
      incidentId: incidents[0].id,
      ownerId: actionOwner.id,
      title: 'Fire safety damper inspection and automated annunciator drill',
      description: 'Carry out comprehensive quarterly smoke detector sensor cleaning, test annunciator speaker decibel levels, and log panel battery resistance.',
      type: 'PREVENTIVE',
      priority: 'MEDIUM',
      dueDate: future14Days,
      status: 'IN_PROGRESS',
      reviewStatus: 'ACTIVE',
      progressNote: 'Zone 1 and Zone 2 diagnostics completed; battery backup cells tested normal.',
      completionRiskScore: 28,
      riskExplanation: { score: 28, level: 'LOW', factors: ['medium priority', 'due in 14 day(s)'], modelVersion: 'action-risk-rules-v1.0' },
    },
  });

  await prisma.actionHistory.create({
    data: {
      actionItemId: act5.id,
      actorId: actionOwner.id,
      eventType: 'PROGRESS_UPDATED',
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
      note: 'Zone 1 and Zone 2 diagnostics completed; battery backup cells tested normal.',
    },
  });

  // Generate Notifications
  await prisma.actionNotification.createMany({
    data: [
      {
        actionItemId: act1.id,
        userId: actionOwner.id,
        type: 'OVERDUE',
        title: 'Action Overdue',
        message: `"${act1.title}" is 3 day(s) overdue. Immediate remediation required.`,
      },
      {
        actionItemId: act2.id,
        userId: actionOwner.id,
        type: 'RETURNED',
        title: 'Revision Required',
        message: `Manager requested revisions for "${act2.title}": Clinical pharmacy audit showed 2 shift rotations were missed.`,
      },
      {
        actionItemId: act2.id,
        userId: actionOwner.id,
        type: 'DUE_SOON',
        title: 'Action Due Soon',
        message: `"${act2.title}" is due in 2 day(s).`,
      },
    ],
  });

  console.log('Action items successfully seeded!');
}

seedActionItems()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
