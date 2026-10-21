// frontend/src/features/manager/pages/ManagerIncidentDetails.tsx ඉහළම imports:

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managerApi } from '../api/manager.api';
import type {
  ManagerIncidentDetail,
  DepartmentUser,
  Severity,
  CapaType,
  CapaPriority,
  ControlEffectiveness,
  ControlStatus,
  ReviewOutcome,
} from '../api/manager.api';
import toast from 'react-hot-toast';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Tag,
  ShieldAlert,
  ClipboardList,
  Search,
  CheckSquare,
  Lock,
  ArrowLeft,
  XCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';

export const ManagerIncidentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const incidentId = Number(id);

  const [incident, setIncident] = useState<ManagerIncidentDetail | null>(null);
  const [team, setTeam] = useState<DepartmentUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'triage' | 'investigation' | 'capa' | 'closure'>('triage');

  // Tab 1: Triage & Correction States
  const [triageRationale, setTriageRationale] = useState('');
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    title: '',
    severity: 'MEDIUM' as Severity,
    category: '',
    location: '',
    auditReason: '',
  });

  // Tab 2: Investigation States
  const [selectedInvestigatorId, setSelectedInvestigatorId] = useState<number | ''>('');
  const [investigationComments, setInvestigationComments] = useState('');

  // Tab 3: CAPA & Controls States
  const [capaForm, setCapaForm] = useState({
    title: '',
    actionType: 'CORRECTIVE' as CapaType,
    priority: 'MEDIUM' as CapaPriority,
    dueDate: '',
    actionOwnerId: '' as number | '',
    description: '',
  });

  const [controlForm, setControlForm] = useState({
    controlType: '',
    effectiveness: 'PARTIALLY_EFFECTIVE' as ControlEffectiveness,
    status: 'PLANNED' as ControlStatus,
    failureReason: '',
    requiredImprovement: '',
    targetDate: '',
  });

  // Tab 4: Review & Closure States
  const [reviewForm, setReviewForm] = useState({
    outcome: 'APPROVED' as ReviewOutcome,
    lessonsLearned: '',
    outcomeComments: '',
    followUpMonitoring: '',
    audience: '',
    scheduledDate: '',
  });
  const [closureSummary, setClosureSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!incidentId || isNaN(incidentId)) return;
    try {
      setIsLoading(true);
      const [incidentRes, teamRes] = await Promise.all([
        managerApi.getIncidentDetails(incidentId),
        managerApi.getDepartmentTeam(),
      ]);
      setIncident(incidentRes);
      setTeam(teamRes.users);
      setCorrectionData({
        title: incidentRes.title,
        severity: incidentRes.severity,
        category: incidentRes.category,
        location: incidentRes.location,
        auditReason: '',
      });
      if (incidentRes.investigatorId) {
        setSelectedInvestigatorId(incidentRes.investigatorId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load incident details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [incidentId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading Clinical Governance Record #{incidentId}...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Incident Not Found</h2>
        <p className="text-slate-600 mt-1">Incident #{incidentId} does not exist in your department.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Governance Closure Gate Invariant Checks ──────────────────────────────
  const hasActions = incident.capaActions && incident.capaActions.length > 0;
  const isGate1Satisfied =
    hasActions && incident.capaActions.every((a) => a.status === 'COMPLETED' && a.isVerified);

  const hasControls = incident.controls && incident.controls.length > 0;
  const isGate2Satisfied =
    hasControls && incident.controls.every((c) => c.status === 'VERIFIED');

  const isGate3Satisfied =
    Boolean(incident.managementReview) && incident.managementReview?.outcome === 'APPROVED';

  const isClosureSummaryValid = closureSummary.trim().length >= 20;
  const canFinalClose = isGate1Satisfied && isGate2Satisfied && isGate3Satisfied && isClosureSummaryValid;

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleTriage = async (decision: 'ACCEPT' | 'REVISE' | 'REJECT') => {
    if (triageRationale.trim().length < 10) {
      toast.error('Please enter a clinical rationale of at least 10 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.triageIncident(incident.id, { decision, rationale: triageRationale });
      toast.success(`Incident triaged as ${decision}`);
      setTriageRationale('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Triage submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (correctionData.auditReason.trim().length < 10) {
      toast.error('Audit reason must be at least 10 characters long.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.correctRecord(incident.id, correctionData);
      toast.success('Audited record correction saved.');
      setIsCorrectionOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Record correction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignInvestigator = async () => {
    if (!selectedInvestigatorId) {
      toast.error('Please select an active investigator.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.assignInvestigator(incident.id, { investigatorId: Number(selectedInvestigatorId) });
      toast.success('Lead Investigator assigned successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign investigator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewFindings = async (decision: 'APPROVE' | 'REVISE') => {
    if (investigationComments.trim().length < 10) {
      toast.error('Review comments must be at least 10 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.reviewInvestigation(incident.id, {
        decision,
        comments: investigationComments,
      });
      toast.success(`Findings review marked as ${decision}`);
      setInvestigationComments('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to review findings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capaForm.actionOwnerId) {
      toast.error('Please assign an Action Owner.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.createCapaAction(incident.id, {
        title: capaForm.title,
        actionType: capaForm.actionType,
        priority: capaForm.priority,
        dueDate: capaForm.dueDate,
        actionOwnerId: Number(capaForm.actionOwnerId),
        description: capaForm.description,
      });
      toast.success('CAPA action logged.');
      setCapaForm({
        title: '',
        actionType: 'CORRECTIVE',
        priority: 'MEDIUM',
        dueDate: '',
        actionOwnerId: '',
        description: '',
      });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create CAPA action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAction = async (actionId: number, decision: 'VERIFY' | 'REVISE') => {
    const notes = prompt(
      decision === 'VERIFY'
        ? 'Enter optional verification approval notes:'
        : 'Enter required reason for revision:'
    );
    if (decision === 'REVISE' && (!notes || notes.trim().length === 0)) {
      toast.error('Revision comments are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.verifyCapaAction(incident.id, actionId, {
        decision,
        notes: notes || undefined,
      });
      toast.success(`Action completion marked as ${decision}`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateControl = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await managerApi.createControl(incident.id, controlForm);
      toast.success('Barrier risk control recorded.');
      setControlForm({
        controlType: '',
        effectiveness: 'PARTIALLY_EFFECTIVE',
        status: 'PLANNED',
        failureReason: '',
        requiredImprovement: '',
        targetDate: '',
      });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add control.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await managerApi.submitReview(incident.id, {
        outcome: reviewForm.outcome,
        lessonsLearned: reviewForm.lessonsLearned,
        outcomeComments: reviewForm.outcomeComments,
        followUpMonitoring: reviewForm.followUpMonitoring,
        dissemination: reviewForm.audience
          ? {
              audience: reviewForm.audience,
              scheduledDate: reviewForm.scheduledDate || new Date().toISOString(),
              status: 'SCHEDULED',
            }
          : undefined,
      });
      toast.success('Management review submitted successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalClose = async () => {
    if (!canFinalClose) {
      toast.error('All 3 governance gates and a 20+ character closure summary are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.closeIncident(incident.id, { closureSummary });
      toast.success('Incident closed and validated under Clinical Governance standards.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Closure failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityBadgeClasses: Record<Severity, string> = {
    LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  const statusBadgeClasses: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
    ACCEPTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
    INVESTIGATING: 'bg-purple-100 text-purple-800 border-purple-300',
    PENDING_ACTION: 'bg-amber-100 text-amber-800 border-amber-300',
    UNDER_REVIEW: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    CLOSED: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                INC-{incident.id.toString().padStart(4, '0')}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{incident.title}</h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                  severityBadgeClasses[incident.severity]
                }`}
              >
                {incident.severity} SEVERITY
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                  statusBadgeClasses[incident.status] || 'bg-slate-100 text-slate-800'
                }`}
              >
                {incident.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCorrectionOpen(!isCorrectionOpen)}
              className="px-3.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
            >
              Audited Correction
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Reporter</p>
              <p>{incident.reporter?.name} ({incident.reporter?.email})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Location & Dept</p>
              <p>{incident.location} • {incident.department?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Category</p>
              <p>{incident.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Logged On</p>
              <p>{new Date(incident.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Audited Correction Collapsible Drawer ────────────────────────── */}
      {isCorrectionOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Audited Record Correction Panel
            </h3>
            <button
              onClick={() => setIsCorrectionOpen(false)}
              className="text-xs text-amber-800 hover:underline"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            Changes to core incident parameters are recorded in the permanent clinical audit log with mandatory justification.
          </p>
          <form onSubmit={handleApplyCorrection} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={correctionData.title}
                onChange={(e) => setCorrectionData({ ...correctionData, title: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Severity</label>
              <select
                value={correctionData.severity}
                onChange={(e) =>
                  setCorrectionData({ ...correctionData, severity: e.target.value as Severity })
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={correctionData.category}
                onChange={(e) => setCorrectionData({ ...correctionData, category: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={correctionData.location}
                onChange={(e) => setCorrectionData({ ...correctionData, location: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Audit Justification / Rationale (Min 10 characters)
              </label>
              <input
                type="text"
                placeholder="Reason for changing severity/category/title"
                value={correctionData.auditReason}
                onChange={(e) =>
                  setCorrectionData({ ...correctionData, auditReason: e.target.value })
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 text-xs"
              >
                Apply Audited Correction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 4-Stage Navigation Tabs ───────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('triage')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'triage'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> 1. Overview & Triage
        </button>
        <button
          onClick={() => setActiveTab('investigation')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'investigation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search className="w-4 h-4" /> 2. Investigation & Findings
        </button>
        <button
          onClick={() => setActiveTab('capa')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'capa'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> 3. Actions & Controls (CAPA)
        </button>
        <button
          onClick={() => setActiveTab('closure')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'closure'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Lock className="w-4 h-4" /> 4. Review & Closure Gate
        </button>
      </div>

      {/* ── TAB 1: OVERVIEW & TRIAGE ───────────────────────────────────────── */}
      {activeTab === 'triage' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Original Incident Report</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-100">
              {incident.description}
            </p>

            {incident.attachments && incident.attachments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Attached Clinical Evidence:</h4>
                <div className="flex flex-wrap gap-2">
                  {incident.attachments.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-xs text-slate-700 rounded-md"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      {file.fileName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Triage Decision Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" /> Manager Triage Evaluation
            </h3>

            {incident.status !== 'OPEN' ? (
              <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-600 border border-slate-200">
                This incident has completed initial triage and is currently in status:{' '}
                <span className="font-bold">{incident.status}</span>.
                {incident.rejectionReason && (
                  <p className="mt-2 text-rose-700">
                    <span className="font-semibold">Rejection Rationale:</span> {incident.rejectionReason}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Triage Decision Rationale (Min 10 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={triageRationale}
                    onChange={(e) => setTriageRationale(e.target.value)}
                    placeholder="Enter clinical assessment rationale for accepting, requesting revision, or rejecting this report..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleTriage('ACCEPT')}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept Report
                  </button>
                  <button
                    onClick={() => handleTriage('REVISE')}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <AlertCircle className="w-4 h-4" /> Request Revision
                  </button>
                  <button
                    onClick={() => handleTriage('REJECT')}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <XCircle className="w-4 h-4" /> Reject Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: INVESTIGATION & FINDINGS REVIEW ─────────────────────────── */}
      {activeTab === 'investigation' && (
        <div className="space-y-6">
          {/* Assignment Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Lead Investigator Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Department Investigator
                </label>
                <select
                  value={selectedInvestigatorId}
                  onChange={(e) => setSelectedInvestigatorId(Number(e.target.value))}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Select Active Department Investigator --</option>
                  {team
                    .filter((u) => u.role === 'INVESTIGATOR')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role}) - {user.email}
                      </option>
                    ))}
                </select>
                {team.filter((u) => u.role === 'INVESTIGATOR').length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No active investigators found in this department. Please assign an investigator in My Team.
                  </p>
                )}
              </div>
              <button
                onClick={handleAssignInvestigator}
                disabled={isSubmitting || !selectedInvestigatorId}
                className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
              >
                Assign & Begin Investigation
              </button>
            </div>
            {incident.investigator && (
              <p className="text-xs text-slate-600 mt-2">
                Currently Assigned Lead: <span className="font-semibold text-slate-800">{incident.investigator.name}</span> ({incident.investigator.email})
              </p>
            )}
          </div>

          {/* Submitted Findings Review */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Investigator Root-Cause Findings</h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  incident.investigationReviewStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : incident.investigationReviewStatus === 'REVISION_REQUESTED'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Review Status: {incident.investigationReviewStatus || 'PENDING'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <p>
                <span className="font-semibold text-slate-700">Root Cause Category:</span>{' '}
                {incident.rootCauseCategory || 'Pending investigator input'}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Root Cause Description:</span>{' '}
                {incident.rootCause || 'No root cause entered yet'}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Detailed Findings:</span>{' '}
                {incident.investigationFindings || 'No detailed findings submitted yet'}
              </p>
            </div>

            {/* Manager Review Controls */}
            <div className="pt-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Manager Review Comments (Min 10 characters)
              </label>
              <textarea
                rows={2}
                value={investigationComments}
                onChange={(e) => setInvestigationComments(e.target.value)}
                placeholder="Enter clinical assessment of these findings..."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleReviewFindings('APPROVE')}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 shadow-sm"
                >
                  Approve Findings
                </button>
                <button
                  onClick={() => handleReviewFindings('REVISE')}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 shadow-sm"
                >
                  Return for Revision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: ACTIONS & CONTROLS (CAPA) ───────────────────────────────── */}
      {activeTab === 'capa' && (
        <div className="space-y-6">
          {/* Section A: CAPA Creator */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Section A: Corrective & Preventive Action Creator
            </h3>
            <form onSubmit={handleCreateCapa} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Action Title</label>
                <input
                  type="text"
                  placeholder="e.g. Implement dual-signoff policy"
                  value={capaForm.title}
                  onChange={(e) => setCapaForm({ ...capaForm, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Action Type</label>
                <select
                  value={capaForm.actionType}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, actionType: e.target.value as CapaType })
                  }
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="CORRECTIVE">Corrective Action</option>
                  <option value="PREVENTIVE">Preventive Action</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={capaForm.priority}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, priority: e.target.value as CapaPriority })
                  }
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={capaForm.dueDate}
                  onChange={(e) => setCapaForm({ ...capaForm, dueDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designated Action Owner</label>
                <select
                  value={capaForm.actionOwnerId}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, actionOwnerId: Number(e.target.value) })
                  }
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                  required
                >
                  <option value="">-- Select Action Owner --</option>
                  {team.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={2}
                  placeholder="Detail the mandatory implementation steps..."
                  value={capaForm.description}
                  onChange={(e) => setCapaForm({ ...capaForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
                >
                  Create CAPA Action
                </button>
              </div>
            </form>
          </div>

          {/* Section B: Action Register Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Section B: CAPA Action Register & Two-Person Verification
            </h3>
            {incident.capaActions && incident.capaActions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="p-3">Title & Type</th>
                      <th className="p-3">Owner</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Verification</th>
                      <th className="p-3 text-right">Manager Verification Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incident.capaActions.map((action) => (
                      <tr key={action.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">
                          {action.title}
                          <span className="block text-[10px] text-slate-500">{action.actionType}</span>
                        </td>
                        <td className="p-3">{action.actionOwner?.name}</td>
                        <td className="p-3">{new Date(action.dueDate).toLocaleDateString()}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              action.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : action.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {action.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {action.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                              <Clock className="w-3.5 h-3.5" /> Unverified
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleVerifyAction(action.id, 'VERIFY')}
                            disabled={isSubmitting}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Verify (Green)
                          </button>
                          <button
                            onClick={() => handleVerifyAction(action.id, 'REVISE')}
                            disabled={isSubmitting}
                            className="px-2.5 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                          >
                            Return Revision
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No CAPA actions registered yet.</p>
            )}
          </div>

          {/* Section C: Controls & Improvement Plan */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Section C: Controls & Risk Improvement Plan
            </h3>
            <form onSubmit={handleCreateControl} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Control Type</label>
                <input
                  type="text"
                  placeholder="e.g. Barcode Medication Verification"
                  value={controlForm.controlType}
                  onChange={(e) => setControlForm({ ...controlForm, controlType: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Effectiveness</label>
                <select
                  value={controlForm.effectiveness}
                  onChange={(e) =>
                    setControlForm({
                      ...controlForm,
                      effectiveness: e.target.value as ControlEffectiveness,
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="EFFECTIVE">Effective</option>
                  <option value="PARTIALLY_EFFECTIVE">Partially Effective</option>
                  <option value="INEFFECTIVE">Ineffective</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Control Status</label>
                <select
                  value={controlForm.status}
                  onChange={(e) =>
                    setControlForm({ ...controlForm, status: e.target.value as ControlStatus })
                  }
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="VERIFIED">Verified</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={controlForm.targetDate}
                  onChange={(e) => setControlForm({ ...controlForm, targetDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Failure Reason (if any)</label>
                <input
                  type="text"
                  placeholder="Why did barrier fail?"
                  value={controlForm.failureReason}
                  onChange={(e) => setControlForm({ ...controlForm, failureReason: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Required Improvement</label>
                <input
                  type="text"
                  placeholder="Engineered barrier fixes"
                  value={controlForm.requiredImprovement}
                  onChange={(e) =>
                    setControlForm({ ...controlForm, requiredImprovement: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
                >
                  Add Risk Control
                </button>
              </div>
            </form>

            {incident.controls && incident.controls.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="py-2">Control Type</th>
                      <th className="py-2">Effectiveness</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Target Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incident.controls.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium">{c.controlType}</td>
                        <td className="py-2">{c.effectiveness}</td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              c.status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2">{new Date(c.targetDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: REVIEW & CLOSURE (THE GOVERNANCE GATE) ───────────────────── */}
      {activeTab === 'closure' && (
        <div className="space-y-6">
          {/* Section A: Management Review Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Section A: Management Review Sign-off</h3>
            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Review Outcome</label>
                  <select
                    value={reviewForm.outcome}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, outcome: e.target.value as ReviewOutcome })
                    }
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="APPROVED">Approved (Ready for Gate Validation)</option>
                    <option value="REVISION_REQUIRED">Revision Required</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Follow-up Monitoring Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 30-day clinical audit follow-up"
                    value={reviewForm.followUpMonitoring}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, followUpMonitoring: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lessons Learned (Clinical Insights)
                </label>
                <textarea
                  rows={2}
                  placeholder="Document key clinical lessons learned..."
                  value={reviewForm.lessonsLearned}
                  onChange={(e) => setReviewForm({ ...reviewForm, lessonsLearned: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Outcome Comments</label>
                <textarea
                  rows={2}
                  placeholder="Formal management assessment commentary..."
                  value={reviewForm.outcomeComments}
                  onChange={(e) => setReviewForm({ ...reviewForm, outcomeComments: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                  required
                />
              </div>

              {/* Section B: Lessons Dissemination */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="font-semibold text-slate-800 mb-2">
                  Section B: Lessons Learned Dissemination (Optional Schedule)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Audience</label>
                    <input
                      type="text"
                      placeholder="e.g. All Surgical & Nursing Staff"
                      value={reviewForm.audience}
                      onChange={(e) => setReviewForm({ ...reviewForm, audience: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      value={reviewForm.scheduledDate}
                      onChange={(e) => setReviewForm({ ...reviewForm, scheduledDate: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
                >
                  Submit Management Review
                </button>
              </div>
            </form>
          </div>

          {/* Section C: Controlled Closure Gate (Crucial) */}
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md space-y-6">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Section C: Controlled Clinical Closure Gate</h3>
            </div>
            <p className="text-xs text-slate-300">
              In accordance with hospital clinical governance rules, this incident cannot be closed until all three gates are fully satisfied.
            </p>

            {/* Visual Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  isGate1Satisfied
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                {isGate1Satisfied ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-white">Gate 1: Actions Verified</p>
                  <p className="text-[11px] mt-0.5">
                    All CAPA actions must be marked COMPLETED and VERIFIED by manager sign-off.
                  </p>
                </div>
              </div>

              <div
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  isGate2Satisfied
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                {isGate2Satisfied ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-white">Gate 2: Controls Verified</p>
                  <p className="text-[11px] mt-0.5">
                    All departmental risk barrier controls must be assessed and VERIFIED.
                  </p>
                </div>
              </div>

              <div
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  isGate3Satisfied
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                {isGate3Satisfied ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-white">Gate 3: Review Approved</p>
                  <p className="text-[11px] mt-0.5">
                    Formal Management Review must be documented with outcome APPROVED.
                  </p>
                </div>
              </div>
            </div>

            {/* Closure Summary & Final Button */}
            {incident.status === 'CLOSED' ? (
              <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-lg text-xs text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Incident Is Formally Closed
                </p>
                <p>Closed At: {incident.closedAt ? new Date(incident.closedAt).toLocaleString() : 'N/A'}</p>
                <p>Closed By: {incident.closedBy?.name || 'Authorized Manager'}</p>
                <p className="mt-2 text-white">
                  <span className="font-semibold text-emerald-300">Closure Summary:</span>{' '}
                  {incident.closureSummary}
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Structured Clinical Closure Summary (Min 20 characters required)
                  </label>
                  <textarea
                    rows={3}
                    value={closureSummary}
                    onChange={(e) => setClosureSummary(e.target.value)}
                    placeholder="Enter formal justification affirming all patient safety risk controls are in place..."
                    className="w-full text-xs p-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Current characters: {closureSummary.trim().length} / 20 required
                  </p>
                </div>

                <button
                  onClick={handleFinalClose}
                  disabled={!canFinalClose || isSubmitting}
                  className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                    canFinalClose && !isSubmitting
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Lock className="w-4 h-4" /> Validate and Close Incident
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerIncidentDetails;