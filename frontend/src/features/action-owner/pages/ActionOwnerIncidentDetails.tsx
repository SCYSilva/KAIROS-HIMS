import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  Clock,
  ShieldCheck,
  Building,
  Calendar,
  AlertCircle,
  ExternalLink,
  Lock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  actionOwnerApi,
  type ActionStatus,
} from '../api/actionOwner.api';

// Enterprise Clinical Theme Colors
const NAVY = '#1E2B5E';
const BORDER = '#D8DCE8';

const formatDate = (isoString: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoString));

const formatDateTime = (isoString: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));

export const ActionOwnerIncidentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actionId = Number(id);

  const [activeTab, setActiveTab] = useState<'progress' | 'evidence' | 'support'>('progress');
  const [status, setStatus] = useState<ActionStatus>('OPEN');
  const [progressNote, setProgressNote] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch Action Record
  const {
    data: item,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['action-owner-detail', actionId],
    queryFn: () => actionOwnerApi.detail(actionId),
    enabled: Number.isInteger(actionId) && actionId > 0,
  });

  // Fetch Decision Support Insights
  const { data: insights } = useQuery({
    queryKey: ['action-owner-insights', actionId],
    queryFn: () => actionOwnerApi.insights(actionId),
    enabled: Boolean(item),
  });

  // Sync state from fetched action record
  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setProgressNote(item.progressNote ?? '');
      setVerificationNotes(item.verificationNotes ?? '');
    }
  }, [item]);

  // Mutations
  const updateProgressMutation = useMutation({
    mutationFn: (payload: {
      status: ActionStatus;
      progressNote: string;
      verificationNotes?: string;
    }) => actionOwnerApi.progress(actionId, payload),
    onSuccess: () => {
      toast.success('Progress saved and logged to audit trail.');
      queryClient.invalidateQueries({ queryKey: ['action-owner-detail', actionId] });
      queryClient.invalidateQueries({ queryKey: ['action-owner-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update progress.');
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: (payload: { progressNote: string; verificationNotes: string }) =>
      actionOwnerApi.resubmit(actionId, payload),
    onSuccess: () => {
      toast.success('Action resubmitted for Manager verification.');
      queryClient.invalidateQueries({ queryKey: ['action-owner-detail', actionId] });
      queryClient.invalidateQueries({ queryKey: ['action-owner-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to resubmit action.');
    },
  });

  const uploadEvidenceMutation = useMutation({
    mutationFn: (file: File) => actionOwnerApi.uploadEvidence(actionId, file),
    onSuccess: () => {
      toast.success('Evidence file uploaded and attached to audit record.');
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['action-owner-detail', actionId] });
      queryClient.invalidateQueries({ queryKey: ['action-owner-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to upload evidence.');
    },
  });

  // Secure File Download/View Handler
  const handleViewEvidence = async (evidenceId: number, fileName: string) => {
    try {
      const blob = await actionOwnerApi.viewEvidence(actionId, evidenceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      toast.success('Evidence file retrieved securely.');
    } catch {
      toast.error('Failed to download evidence file.');
    }
  };

  const isLocked = item?.reviewStatus === 'VERIFIED';
  const isReturned = item?.reviewStatus === 'RETURNED_FOR_REVISION';
  const isCompleting = status === 'COMPLETED';

  // Submission handler
  const handleSaveProgress = () => {
    if (progressNote.trim().length < 5) {
      toast.error('Progress note must be at least 5 characters long.');
      return;
    }

    if (isCompleting && verificationNotes.trim().length < 10) {
      toast.error('Verification notes (minimum 10 characters) are required for completion.');
      return;
    }

    if (isReturned && isCompleting) {
      resubmitMutation.mutate({
        progressNote: progressNote.trim(),
        verificationNotes: verificationNotes.trim(),
      });
    } else {
      updateProgressMutation.mutate({
        status,
        progressNote: progressNote.trim(),
        verificationNotes: isCompleting ? verificationNotes.trim() : undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white border border-[#D8DCE8]" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-white border border-[#D8DCE8]" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
        <h3 className="mt-3 text-lg font-bold text-red-800">Action Not Found</h3>
        <p className="mt-1 text-sm text-red-600">
          This action does not exist or you do not have permission to view it.
        </p>
        <button
          type="button"
          onClick={() => navigate('/action-owner')}
          className="mt-4 rounded-lg bg-[#1E2B5E] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 text-[#1A2447]">
      {/* ── Top Navigation Link ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/action-owner')}
        className="flex items-center gap-2 text-sm font-semibold text-[#2952C4] hover:underline cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Action Owner Dashboard
      </button>

      {/* ── Header Context ─────────────────────────────────────────────── */}
      <header
        className="rounded-2xl p-6 text-white shadow-sm md:p-8"
        style={{
          backgroundColor: NAVY,
          border: '1px solid #141F45',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-200">
                ACT-{String(item.id).padStart(4, '0')}
              </span>
              <span className="text-blue-300">•</span>
              <span className="text-xs font-semibold text-blue-100">
                Incident #{item.incident.id} ({item.incident.category})
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
              {item.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-blue-100">
              {item.description}
            </p>
          </div>

          {/* Status & Priority Tags */}
          <div className="flex flex-col items-start gap-2 shrink-0 lg:items-end">
            <span
              className={`rounded-full border px-3.5 py-1 text-xs font-bold uppercase tracking-wider ${
                item.reviewStatus === 'VERIFIED'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : item.reviewStatus === 'RETURNED_FOR_REVISION'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : item.reviewStatus === 'COMPLETED_PENDING_VERIFICATION'
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                  : 'border-white/20 bg-white/10 text-white'
              }`}
            >
              {item.reviewStatus === 'RETURNED_FOR_REVISION'
                ? 'Revision Required'
                : item.reviewStatus === 'COMPLETED_PENDING_VERIFICATION'
                ? 'Awaiting Verification'
                : item.reviewStatus === 'VERIFIED'
                ? 'Verified Effective'
                : item.status.replaceAll('_', ' ')}
            </span>

            <div className="flex items-center gap-2 text-xs text-blue-200">
              <span className="font-semibold uppercase tracking-wider">{item.type}</span>
              <span>•</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  item.priority === 'CRITICAL'
                    ? 'bg-red-500/30 text-red-200 border border-red-400/40'
                    : item.priority === 'HIGH'
                    ? 'bg-orange-500/30 text-orange-200 border border-orange-400/40'
                    : 'bg-white/15 text-blue-100'
                }`}
              >
                {item.priority} Priority
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Manager Feedback Alerts ─────────────────────────────────────── */}
      {isReturned && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-5 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Department Manager Feedback: Action Returned for Revision
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                {item.managerReviewComment ||
                  'The manager indicated further remediation evidence or protocol adjustment is required.'}
              </p>
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Update your progress note, attach additional evidence if needed, and resubmit for verification.
              </p>
            </div>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-5 text-emerald-900 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-emerald-900">
                Manager Verified & Locked: Clinical Governance Closed
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                {item.managerReviewComment ||
                  'Department Manager has verified the completed corrective action and confirmed clinical compliance.'}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-emerald-700">
                <span>Rating: {item.effectiveness || 'EFFECTIVE'}</span>
                {item.effectivenessScore != null && (
                  <span>Score: {item.effectivenessScore}% Effectiveness</span>
                )}
                <span>• Closed-loop audit confirmed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Metadata Cards Grid (4 Cards) ───────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Parent Incident */}
        <div
          className="rounded-xl bg-white p-4 shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6B7494]">
            <Layers className="h-4 w-4 text-[#2952C4]" />
            Parent Incident
          </div>
          <p className="mt-2 text-sm font-bold text-[#1A2447] truncate">
            #{item.incident.id} {item.incident.title}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7494]">
            Severity: {item.incident.severity}
          </p>
        </div>

        {/* Department */}
        <div
          className="rounded-xl bg-white p-4 shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6B7494]">
            <Building className="h-4 w-4 text-[#2952C4]" />
            Department
          </div>
          <p className="mt-2 text-sm font-bold text-[#1A2447]">
            {item.incident.department.name}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7494]">
            Location: {item.incident.location || 'Hospital Campus'}
          </p>
        </div>

        {/* Due Date */}
        <div
          className="rounded-xl bg-white p-4 shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6B7494]">
            <Calendar className="h-4 w-4 text-[#2952C4]" />
            Due Date
          </div>
          <p className="mt-2 text-sm font-bold text-[#1A2447]">
            {formatDate(item.dueDate)}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7494]">Target SLA Deadline</p>
        </div>

        {/* Due State */}
        <div
          className="rounded-xl bg-white p-4 shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6B7494]">
            <Clock className="h-4 w-4 text-[#2952C4]" />
            Due State
          </div>
          <p
            className={`mt-2 text-sm font-bold ${
              item.status === 'COMPLETED'
                ? 'text-emerald-700'
                : item.overdue
                ? 'text-red-700'
                : item.dueInDays <= 3
                ? 'text-amber-700'
                : 'text-[#1A2447]'
            }`}
          >
            {item.status === 'COMPLETED'
              ? item.reviewStatus === 'VERIFIED'
                ? 'Verified'
                : 'Submitted for verification'
              : item.overdue
              ? `${Math.abs(item.dueInDays)} day(s) overdue`
              : item.dueInDays === 0
              ? 'Due today'
              : `${item.dueInDays} day(s) remaining`}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7494]">
            {item.status === 'COMPLETED' ? 'Work completed' : 'Compliance clock active'}
          </p>
        </div>
      </div>

      {/* ── 3-Tab Navigation Bar ────────────────────────────────────────── */}
      <nav
        className="flex gap-2 rounded-xl bg-white p-1.5 shadow-sm"
        style={{ border: `1px solid ${BORDER}` }}
        aria-label="Clinical workspace tabs"
      >
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-[#1E2B5E] text-white shadow-sm'
              : 'text-[#6B7494] hover:bg-slate-50 hover:text-[#1A2447]'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Progress & Execution</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition cursor-pointer ${
            activeTab === 'evidence'
              ? 'bg-[#1E2B5E] text-white shadow-sm'
              : 'text-[#6B7494] hover:bg-slate-50 hover:text-[#1A2447]'
          }`}
        >
          <Upload className="h-4 w-4" />
          <span>Evidence & Audit Trail</span>
          {item.evidence && item.evidence.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'evidence' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {item.evidence.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('support')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition cursor-pointer ${
            activeTab === 'support'
              ? 'bg-[#1E2B5E] text-white shadow-sm'
              : 'text-[#6B7494] hover:bg-slate-50 hover:text-[#1A2447]'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Clinical Decision Support</span>
        </button>
      </nav>

      {/* ── TAB 1: PROGRESS (THE MAIN EXECUTION TAB) ────────────────────── */}
      {activeTab === 'progress' && (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          {/* Main Execution Card */}
          <section
            className="rounded-2xl bg-white p-6 shadow-sm space-y-5"
            style={{ border: `1.5px solid ${BORDER}` }}
          >
            <div>
              <h2 className="text-lg font-bold text-[#1A2447]">Corrective Action Execution</h2>
              <p className="text-xs text-[#6B7494] mt-0.5">
                Record your operational remediation details. Transitioning to Completed requires formal verification notes.
              </p>
            </div>

            {/* Status Selector */}
            <div>
              <label
                htmlFor="action-status-select"
                className="block text-xs font-bold uppercase tracking-wider text-[#1A2447] mb-2"
              >
                Action Lifecycle Status
              </label>
              <select
                id="action-status-select"
                disabled={isLocked}
                value={status}
                onChange={(e) => setStatus(e.target.value as ActionStatus)}
                className="w-full rounded-xl border border-[#D8DCE8] bg-white px-4 py-3 text-sm font-semibold text-[#1A2447] outline-none transition focus:border-[#2952C4] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="OPEN">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed — submit for verification</option>
              </select>
            </div>

            {/* Progress Note Textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="progress-note"
                  className="text-xs font-bold uppercase tracking-wider text-[#1A2447]"
                >
                  Progress Note
                </label>
                <span
                  className={`text-xs font-medium ${
                    progressNote.trim().length >= 5 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {progressNote.trim().length} / 5 chars min
                </span>
              </div>
              <textarea
                id="progress-note"
                disabled={isLocked}
                rows={4}
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                placeholder="Detail current operational progress, key milestones reached, or any blockers encountered..."
                className="w-full rounded-xl border border-[#D8DCE8] bg-slate-50/50 p-4 text-sm text-[#1A2447] outline-none transition focus:border-[#2952C4] focus:bg-white focus:ring-2 focus:ring-blue-100 resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Verification Notes Textarea (Conditionally visible & mandatory on Completed) */}
            {isCompleting && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="verification-notes"
                    className="text-xs font-bold uppercase tracking-wider text-[#1E2B5E]"
                  >
                    Evidence-Based Verification Notes (Mandatory for Completion)
                  </label>
                  <span
                    className={`text-xs font-medium ${
                      verificationNotes.trim().length >= 10
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {verificationNotes.trim().length} / 10 chars min
                  </span>
                </div>
                <textarea
                  id="verification-notes"
                  disabled={isLocked}
                  rows={4}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Describe the physical outcome, test readings, protocol changes, and how the manager can verify completion..."
                  className="w-full rounded-xl border border-blue-200 bg-white p-4 text-sm text-[#1A2447] outline-none transition focus:border-[#2952C4] focus:ring-2 focus:ring-blue-100 resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-[#6B7494]">
                  Clinical governance requires explicit verification notes before an action can enter the two-person manager review queue.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveProgress}
                disabled={
                  isLocked ||
                  updateProgressMutation.isPending ||
                  resubmitMutation.isPending ||
                  progressNote.trim().length < 5 ||
                  (isCompleting && verificationNotes.trim().length < 10)
                }
                className={`rounded-xl px-6 py-3 text-sm font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCompleting
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-[#1E2B5E] hover:bg-[#152048]'
                }`}
              >
                {updateProgressMutation.isPending || resubmitMutation.isPending
                  ? 'Saving to Audit Trail...'
                  : isReturned && isCompleting
                  ? 'Resubmit for Verification'
                  : isCompleting
                  ? 'Submit for Verification'
                  : 'Save Progress'}
              </button>

              {isLocked && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Lock className="h-4 w-4" />
                  Locked following Manager verification
                </div>
              )}
            </div>
          </section>

          {/* Due-Date Risk Indicator Card */}
          <aside
            className="rounded-2xl bg-white p-6 shadow-sm space-y-4"
            style={{ border: `1.5px solid ${BORDER}` }}
          >
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#6B7494]">
                Due-Date Risk Indicator
              </h3>
              <p className="text-xs text-[#6B7494] mt-0.5">
                Rule-based clinical completion SLA assessment.
              </p>
            </div>

            <div className="rounded-xl border border-[#D8DCE8] bg-slate-50 p-5 text-center">
              <span
                className={`text-4xl font-extrabold ${
                  item.completionRisk.level === 'HIGH'
                    ? 'text-red-700'
                    : item.completionRisk.level === 'MEDIUM'
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {item.completionRisk.score}%
              </span>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                {item.completionRisk.level} Risk Rating
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-[#1A2447] mb-2">Evaluated Risk Drivers:</p>
              <ul className="space-y-1.5 text-xs text-[#6B7494]">
                {item.completionRisk.factors.map((factor, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-blue-50/70 p-3 text-[11px] text-blue-900 border border-blue-100">
              <p className="font-semibold">Governance SLA Rule:</p>
              <p className="mt-0.5 text-blue-800">
                Critical/High actions approaching within 3 days are elevated to proactive supervision in the Department Manager oversight dashboard.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* ── TAB 2: EVIDENCE & AUDIT TRAIL ──────────────────────────────── */}
      {activeTab === 'evidence' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* File Evidence Upload Card */}
          <section
            className="rounded-2xl bg-white p-6 shadow-sm space-y-5"
            style={{ border: `1.5px solid ${BORDER}` }}
          >
            <div>
              <h2 className="text-lg font-bold text-[#1A2447]">Clinical Evidence Upload</h2>
              <p className="text-xs text-[#6B7494] mt-0.5">
                Attach certified inspection reports, calibration certificates, training sign-offs, or photos (JPG, PNG, PDF up to 5MB).
              </p>
            </div>

            {/* Dropzone / File Picker */}
            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                isLocked
                  ? 'border-slate-200 bg-slate-50 opacity-60'
                  : 'border-[#D8DCE8] bg-slate-50 hover:bg-slate-100/70'
              }`}
            >
              <input
                id="evidence-file-input"
                type="file"
                disabled={isLocked}
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="evidence-file-input"
                className={`flex flex-col items-center justify-center cursor-pointer ${
                  isLocked ? 'cursor-not-allowed' : ''
                }`}
              >
                <Upload className="h-8 w-8 text-[#2952C4]" />
                <span className="mt-2 text-xs font-bold text-[#1A2447]">
                  {selectedFile ? selectedFile.name : 'Choose file or click to select'}
                </span>
                <span className="text-[11px] text-[#6B7494] mt-0.5">
                  JPG, PNG, or PDF • Up to 5 MB
                </span>
              </label>

              {selectedFile && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">
                    {Math.round(selectedFile.size / 1024)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      selectedFile && uploadEvidenceMutation.mutate(selectedFile)
                    }
                    disabled={uploadEvidenceMutation.isPending || isLocked}
                    className="rounded-lg bg-[#1E2B5E] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#152048] cursor-pointer"
                  >
                    {uploadEvidenceMutation.isPending ? 'Uploading...' : 'Confirm Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Attached Evidence List */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2447] mb-3">
                Attached Audit Evidence ({item.evidence?.length ?? 0})
              </h3>
              {!item.evidence?.length ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-[#6B7494]">
                  No evidence files attached yet. Upload documentation to support closure verification.
                </p>
              ) : (
                <div className="divide-y divide-[#D8DCE8] rounded-xl border border-[#D8DCE8] bg-white">
                  {item.evidence.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-[#2952C4] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1A2447] truncate">
                            {file.fileName}
                          </p>
                          <p className="text-[10px] text-[#6B7494]">
                            {Math.round(file.fileSize / 1024)} KB • {formatDate(file.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewEvidence(file.id, file.fileName)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#2952C4] hover:underline cursor-pointer shrink-0 ml-3"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Chronological Audit Trail Timeline */}
          <section
            className="rounded-2xl bg-white p-6 shadow-sm space-y-4"
            style={{ border: `1.5px solid ${BORDER}` }}
          >
            <div>
              <h2 className="text-lg font-bold text-[#1A2447]">Chronological Audit Trail</h2>
              <p className="text-xs text-[#6B7494] mt-0.5">
                Tamper-evident record of assignment, progress changes, resubmissions, and manager sign-offs.
              </p>
            </div>

            {!item.history?.length ? (
              <p className="text-xs text-[#6B7494]">No audit entries recorded.</p>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                {item.history.map((event, idx) => (
                  <div key={event.id || idx} className="relative pl-6 pb-2 border-l-2 border-blue-200">
                    <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-[#2952C4] border-2 border-white" />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1A2447]">
                          {event.eventType.replaceAll('_', ' ')}
                        </span>
                        <span className="text-[10px] text-[#6B7494]">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Actor: <span className="font-semibold text-slate-700">{event.actor?.name || 'System'}</span>
                        {event.actor?.role && ` (${event.actor.role})`}
                      </p>
                      {event.note && (
                        <p className="mt-1 rounded-lg bg-slate-50 p-2.5 text-xs text-[#1A2447] border border-[#D8DCE8]">
                          {event.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── TAB 3: CLINICAL DECISION SUPPORT ────────────────────────────── */}
      {activeTab === 'support' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Similar Past Corrective Actions */}
          <section
            className="rounded-2xl bg-white p-6 shadow-sm space-y-4"
            style={{ border: `1.5px solid ${BORDER}` }}
          >
            <div>
              <h2 className="text-lg font-bold text-[#1A2447]">
                Hospital Verified Similar Actions
              </h2>
              <p className="text-xs text-[#6B7494] mt-0.5">
                Past corrective actions from similar incidents verified effective by clinical leadership.
              </p>
            </div>

            {!insights?.similarActions?.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-[#6B7494]">
                <HelpCircle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                No similar historical actions met the correlation threshold for this incident context.
              </div>
            ) : (
              <div className="space-y-3">
                {insights.similarActions.map((sim) => (
                  <div
                    key={sim.id}
                    className="rounded-xl border border-[#D8DCE8] bg-slate-50/70 p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#2952C4]">
                        ACT-{String(sim.id).padStart(4, '0')}
                      </span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#1E2B5E]">
                        {Math.round(sim.similarityScore * 100)}% Semantic Match
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#1A2447]">{sim.title}</h4>
                    <p className="text-xs text-[#6B7494] line-clamp-2 leading-relaxed">
                      {sim.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>Source Incident #{sim.incident.id}</span>
                      <span className="font-semibold text-emerald-700">
                        {sim.effectiveness || 'Verified Effective'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Best Practice Clinical Recommendations */}
          <section
            className="rounded-2xl bg-white p-6 shadow-sm space-y-4"
            style={{ border: `1.5px solid ${BORDER}` }}
          >
            <div>
              <h2 className="text-lg font-bold text-[#1A2447]">
                Clinical Governance Recommendations
              </h2>
              <p className="text-xs text-[#6B7494] mt-0.5">
                Standardized recommendations drawn from high-scoring historical remediations.
              </p>
            </div>

            {!insights?.recommendations?.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-[#6B7494]">
                <ShieldCheck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                Recommendations will display once historical verified remediation patterns are recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {insights.recommendations.map((rec) => (
                  <div
                    key={rec.key}
                    className="rounded-xl border border-[#D8DCE8] bg-white p-4 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#1A2447]">{rec.title}</h4>
                      {rec.effectivenessScore != null && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {rec.effectivenessScore}% Effectiveness
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7494] leading-relaxed">
                      {rec.description}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Validated in source Incident #{rec.sourceIncident.id}: {rec.sourceIncident.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default ActionOwnerIncidentDetails;