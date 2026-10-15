import React, { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Clock,
  UserCheck,
  Plus,
  Trash2,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Users,
  Compass,
  Paperclip,
  Bookmark,
  Check,
  Send,
  Save,
} from 'lucide-react';
import {
  investigationApi,
  type InvestigationMethod,
} from '../api/investigation.api';


// ── Enterprise Clinical Color Tokens ─────────────────────────────────────────
const NAVY = '#0F1E42';
const BORDER = '#D8DCE8';
const TEXT = '#1A2447';
const MUTED = '#6B7494';
const SURFACE = '#FFFFFF';
const BG_PAGE = '#F8FAFC';

const METHODS: Array<{ value: InvestigationMethod; label: string }> = [
  { value: 'FIVE_WHYS', label: '5 Whys Analysis' },
  { value: 'FISHBONE', label: 'Fishbone / Ishikawa Diagram' },
  { value: 'FAULT_TREE', label: 'Fault Tree Analysis' },
  { value: 'TIMELINE_ANALYSIS', label: 'Chronological Timeline Analysis' },
  { value: 'OTHER', label: 'Other Clinical Methodology' },
];

const ROOT_CAUSE_CATEGORIES = [
  'Clinical Process / Protocol Deviation',
  'Medication Administration & Dispensing',
  'Equipment & Medical Device Malfunction',
  'Interdisciplinary Communication Gap',
  'Patient Identification & Handover',
  'Environmental & Facility Safety',
  'Staffing / Workload Pressure',
  'Documentation & Electronic Records',
];

const Panel: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, children, className = '' }) => (
  <section
    className={`rounded-2xl p-6 shadow-sm transition-all ${className}`}
    style={{
      backgroundColor: SURFACE,
      border: `1.5px solid ${BORDER}`,
    }}
  >
    <div className="flex items-start gap-3 mb-5 border-b pb-4" style={{ borderColor: BORDER }}>
      {icon && <div className="p-2 rounded-xl bg-slate-100 text-[#0F1E42] mt-0.5">{icon}</div>}
      <div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight" style={{ color: TEXT }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: MUTED }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {children}
  </section>
);

const InvestigatorWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const incidentId = Number(paramId);
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: record,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['investigation-workspace', incidentId],
    queryFn: () => investigationApi.workspace(incidentId),
    enabled: Number.isInteger(incidentId) && incidentId > 0,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['investigation-candidates', incidentId],
    queryFn: () => investigationApi.candidates(incidentId),
    enabled: !!record,
  });

  const { data: decisionSupport } = useQuery({
    queryKey: ['investigation-decision-support', incidentId],
    queryFn: () => investigationApi.decisionSupport(incidentId),
    enabled: !!record,
  });

  // ── Form States ────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState({
    startDate: '',
    endDate: '',
    method: '' as InvestigationMethod | '',
    methodOther: '',
    findingsSummary: '',
    rootCauseCategory: '',
    rootCauseSubcategory: '',
    rootCauseDescription: '',
    rootCauseMethod: '' as InvestigationMethod | '',
    rootCauseDetail: '',
    systemicIssue: false,
  });

  const [factors, setFactors] = useState<Array<{ category: string; description: string }>>([]);
  const [newFactor, setNewFactor] = useState({ category: '', description: '' });

  // Sub-entity inputs
  const [teamInput, setTeamInput] = useState({ userId: '', role: 'Co-Investigator' });
  const [witnessInput, setWitnessInput] = useState({
    name: '',
    roleOrContact: '',
    statement: '',
    interviewedAt: '',
  });
  const [timelineInput, setTimelineInput] = useState({
    occurredAt: '',
    title: '',
    description: '',
    source: '',
  });
  const [evidenceInput, setEvidenceInput] = useState({
    attachmentId: '',
    label: '',
    reference: '',
    notes: '',
  });

  // ── Synchronize with loaded record ─────────────────────────────────────────
  useEffect(() => {
    if (record) {
      setDraft({
        startDate: record.startDate ? record.startDate.slice(0, 10) : '',
        endDate: record.endDate ? record.endDate.slice(0, 10) : '',
        method: record.method ?? '',
        methodOther: record.methodOther ?? '',
        findingsSummary: record.findingsSummary ?? '',
        rootCauseCategory: record.rootCauseCategory ?? '',
        rootCauseSubcategory: record.rootCauseSubcategory ?? '',
        rootCauseDescription: record.rootCauseDescription ?? '',
        rootCauseMethod: record.rootCauseMethod ?? '',
        rootCauseDetail: record.rootCauseDetail ?? '',
        systemicIssue: Boolean(record.systemicIssue),
      });

      setFactors(
        record.contributingFactors?.map((f) => ({
          category: f.category,
          description: f.description,
        })) ?? []
      );
    }
  }, [record]);

  // ── Generic Mutation Runner ────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['investigation-workspace', incidentId] }),
        queryClient.invalidateQueries({ queryKey: ['investigation-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['investigation-decision-support', incidentId] }),
      ]);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Action failed.';
      toast.error(msg);
    },
  });

  const run = (fn: () => Promise<unknown>, successMsg?: string) => {
    mutation.mutate(fn, {
      onSuccess: () => {
        if (successMsg) toast.success(successMsg);
      },
    });
  };

  // ── Save Draft Action ──────────────────────────────────────────────────────
  const handleSaveDraft = (notify = true) => {
    run(
      () =>
        investigationApi.saveDraft(incidentId, {
          ...draft,
          startDate: draft.startDate || null,
          endDate: draft.endDate || null,
          method: draft.method || null,
          methodOther: draft.method === 'OTHER' ? draft.methodOther : null,
          rootCauseMethod: draft.rootCauseMethod || null,
          contributingFactors: factors,
        }),
      notify ? 'Draft saved successfully (Incident state preserved)' : undefined
    );
  };

  // ── Final Submit Action ────────────────────────────────────────────────────
  const handleSubmitFinal = () => {
    if (readiness.missing.length > 0) {
      toast.error(`Incomplete submission: ${readiness.missing.join(', ')}`);
      return;
    }

    run(
      () => investigationApi.submit(incidentId),
      record?.status === 'REVISION_REQUESTED'
        ? 'Revised findings successfully submitted for Manager review.'
        : 'Investigation successfully submitted to Manager.'
    );
  };

  // ── Readiness Checklist Calculation ────────────────────────────────────────
  const readiness = useMemo(() => {
    const checks = [
      {
        id: 'start_date',
        label: 'Investigation start date specified',
        ready: Boolean(draft.startDate),
      },
      {
        id: 'method',
        label: 'Clinical investigation methodology selected',
        ready: Boolean(draft.method && (draft.method !== 'OTHER' || draft.methodOther.trim())),
      },
      {
        id: 'findings',
        label: 'Comprehensive findings narrative documented (min 20 chars)',
        ready: Boolean(draft.findingsSummary && draft.findingsSummary.trim().length >= 20),
      },
      {
        id: 'factors',
        label: 'At least 1 contributing factor recorded',
        ready: factors.length > 0,
      },
      {
        id: 'rca_category',
        label: 'Root cause category and sub-category categorized',
        ready: Boolean(draft.rootCauseCategory.trim() && draft.rootCauseSubcategory.trim()),
      },
      {
        id: 'rca_method',
        label: 'Root cause analysis method chosen',
        ready: Boolean(draft.rootCauseMethod),
      },
      {
        id: 'rca_statement',
        label: 'Evidence-based root cause statement documented (min 20 chars)',
        ready: Boolean(draft.rootCauseDescription && draft.rootCauseDescription.trim().length >= 20),
      },
      {
        id: 'rca_detail',
        label: 'In-depth causal reasoning analysis logged (min 20 chars)',
        ready: Boolean(draft.rootCauseDetail && draft.rootCauseDetail.trim().length >= 20),
      },
    ];

    const missing = checks.filter((c) => !c.ready).map((c) => c.label);
    const completedCount = checks.filter((c) => c.ready).length;
    return {
      checks,
      missing,
      completedCount,
      totalCount: checks.length,
      allReady: missing.length === 0,
    };
  }, [draft, factors]);

  // ── Render States ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <div
          className="animate-spin rounded-full h-10 w-10 border-[3px] border-t-transparent"
          style={{ borderColor: `${NAVY} transparent ${NAVY} ${NAVY}` }}
        />
        <p className="text-sm font-semibold tracking-wide" style={{ color: TEXT }}>
          Securing clinical investigation workspace…
        </p>
      </div>
    );
  }

  if (isError || !record) {
    return (
      <div className="p-8 rounded-2xl border border-red-200 bg-red-50 text-red-900 space-y-4 text-center max-w-xl mx-auto my-12">
        <AlertCircle className="w-10 h-10 mx-auto text-red-600" />
        <h2 className="text-xl font-bold">Investigation Record Inaccessible</h2>
        <p className="text-sm text-red-600">
          {error instanceof Error
            ? error.message
            : 'This incident is not assigned to you or you lack the required investigator privileges.'}
        </p>
        <button
          onClick={() => navigate('/investigator')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0F1E42] hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isLocked = ['SUBMITTED', 'APPROVED'].includes(record.status);
  const inc = record.incident;

  const inputStyle = `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0F1E42] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`;

  return (
    <div className="space-y-6 pb-16" style={{ backgroundColor: BG_PAGE }}>
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/investigator')}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#0F1E42] hover:text-blue-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assigned Investigation Queue
        </button>

        <div className="flex items-center gap-2">
          {!isLocked && (
            <button
              onClick={() => handleSaveDraft(true)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 bg-white hover:bg-slate-50 transition-colors text-slate-800 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-600" />
              Save Draft
            </button>
          )}
        </div>
      </div>

      {/* ── Header & Clinical Context ──────────────────────────────────────── */}
      <header
        className="rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden"
        style={{
          backgroundColor: NAVY,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="px-2.5 py-1 rounded bg-white/10 border border-white/15">
                Investigation #{record.id}
              </span>
              <span>•</span>
              <span className="px-2.5 py-1 rounded bg-white/10 border border-white/15">
                Incident #{inc.id}
              </span>
              <span>•</span>
              <span className="text-slate-300">Revision {record.revisionNumber}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight pt-1">
              {inc.title}
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed max-w-2xl">
              {inc.description}
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-bold bg-white/15 border border-white/20 tracking-wider">
                {record.status.replaceAll('_', ' ')}
              </span>
              <span
                className={`px-3 py-1 rounded-md text-xs font-extrabold tracking-wider ${
                  inc.severity === 'CRITICAL'
                    ? 'bg-red-500 text-white'
                    : inc.severity === 'HIGH'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/20 text-white'
                }`}
              >
                {inc.severity} SEVERITY
              </span>
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Target Completion:{' '}
                {record.endDate ? new Date(record.endDate).toLocaleDateString() : 'Unscheduled'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Status Banners: Revision Requested / Locked ───────────────────── */}
      {record.status === 'REVISION_REQUESTED' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 flex items-start gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800 mt-0.5">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm sm:text-base text-amber-900">
              Department Manager Requested Revisions (Revision #{record.revisionNumber})
            </h3>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
              <strong>Manager Feedback:</strong>{' '}
              {inc.investigationReviewComment ||
                'The findings require clarification or additional evidence prior to sign-off.'}
            </p>
            <p className="text-xs text-amber-700 pt-1 font-medium">
              Update the investigation findings below and submit through the submission gate when complete.
            </p>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 flex items-start gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-blue-100 text-[#0F1E42] mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm sm:text-base text-[#0F1E42]">
              {record.status === 'APPROVED'
                ? 'Clinical Findings Approved & Locked'
                : 'Investigation Submitted for Review (Read-Only)'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {record.status === 'APPROVED'
                ? 'Department Management has verified and closed this investigation. Findings are permanently archived for clinical audit.'
                : 'This investigation is currently pending review by the Department Manager. Editing is restricted unless returned for revision.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Clinical Incident Metadata Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Primary Reporter', value: inc.reporter?.name ?? 'Anonymous Staff', sub: inc.reporter?.email },
          { label: 'Department of Origin', value: inc.department?.name ?? 'N/A', sub: `Incident Category: ${inc.category}` },
          { label: 'Exact Incident Location', value: inc.location, sub: `Logged: ${new Date(inc.createdAt).toLocaleString()}` },
        ].map((meta) => (
          <div
            key={meta.label}
            className="rounded-2xl p-4 shadow-sm"
            style={{
              backgroundColor: SURFACE,
              border: `1.5px solid ${BORDER}`,
            }}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              {meta.label}
            </span>
            <div className="text-sm font-extrabold mt-1 truncate" style={{ color: TEXT }}>
              {meta.value}
            </div>
            {meta.sub && <div className="text-xs text-slate-400 mt-0.5 truncate">{meta.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Section 1: Investigation Plan & Findings ───────────────────────── */}
      <Panel
        title="Section 1: Investigation Plan & Clinical Narrative"
        subtitle="Establish the timeframe, analytical methodology, and structured findings without changing incident status"
        icon={<Compass className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Investigation Start Date *
            </label>
            <input
              type="date"
              disabled={isLocked}
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Target Completion Date
            </label>
            <input
              type="date"
              disabled={isLocked}
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Analytical Methodology *
            </label>
            <select
              disabled={isLocked}
              value={draft.method}
              onChange={(e) =>
                setDraft({ ...draft, method: e.target.value as InvestigationMethod })
              }
              className={inputStyle}
              style={{ borderColor: BORDER }}
            >
              <option value="">Select clinical method…</option>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Specify Other Method
            </label>
            <input
              type="text"
              disabled={isLocked || draft.method !== 'OTHER'}
              value={draft.methodOther}
              onChange={(e) => setDraft({ ...draft, methodOther: e.target.value })}
              placeholder={draft.method === 'OTHER' ? 'Name methodology…' : 'Select OTHER to enable'}
              className={inputStyle}
              style={{ borderColor: BORDER }}
            />
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Findings Summary (Rich Clinical Narrative) *
            </label>
            <textarea
              rows={4}
              disabled={isLocked}
              value={draft.findingsSummary}
              onChange={(e) => setDraft({ ...draft, findingsSummary: e.target.value })}
              placeholder="Provide a thorough, clinical narrative detailing what happened, operational context, human factors, and key observations…"
              className={`${inputStyle} resize-y leading-relaxed`}
              style={{ borderColor: BORDER }}
            />
            <div className="flex justify-between items-center text-xs mt-1 text-slate-400">
              <span>Objective, factual observations supported by clinical records.</span>
              <span className={draft.findingsSummary.length >= 20 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-medium'}>
                {draft.findingsSummary.length} characters (min 20)
              </span>
            </div>
          </div>
        </div>

        {!isLocked && (
          <div className="mt-4 pt-4 border-t flex justify-end" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => handleSaveDraft(true)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0F1E42] hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Section 1 Draft
            </button>
          </div>
        )}
      </Panel>

      {/* ── Section 2: Contributing Factors & Team Collaboration ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contributing Factors Panel */}
        <Panel
          title="Contributing Factors"
          subtitle="Document multi-factorial influences (systemic, human, environmental)"
          icon={<Layers className="w-5 h-5" />}
        >
          {!isLocked && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 border" style={{ borderColor: BORDER }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Category (e.g. Ergonomics)"
                  value={newFactor.category}
                  onChange={(e) => setNewFactor({ ...newFactor, category: e.target.value })}
                  className={`${inputStyle} sm:col-span-1`}
                  style={{ borderColor: BORDER }}
                />
                <input
                  type="text"
                  placeholder="Description of contributing factor"
                  value={newFactor.description}
                  onChange={(e) => setNewFactor({ ...newFactor, description: e.target.value })}
                  className={`${inputStyle} sm:col-span-2`}
                  style={{ borderColor: BORDER }}
                />
              </div>
              <button
                type="button"
                disabled={!newFactor.category.trim() || !newFactor.description.trim()}
                onClick={() => {
                  setFactors([...factors, newFactor]);
                  setNewFactor({ category: '', description: '' });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0F1E42] hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Contributing Factor
              </button>
            </div>
          )}

          <div className="space-y-2 mt-4">
            {factors.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No contributing factors logged yet. At least one required for formal submission.
              </p>
            ) : (
              factors.map((f, idx) => (
                <div
                  key={`${f.category}-${idx}`}
                  className="p-3.5 rounded-xl border bg-white flex items-center justify-between gap-3 text-xs"
                  style={{ borderColor: BORDER }}
                >
                  <div>
                    <span className="font-extrabold text-[#0F1E42] uppercase tracking-wide mr-2">
                      [{f.category}]
                    </span>
                    <span className="text-slate-700">{f.description}</span>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => setFactors(factors.filter((_, i) => i !== idx))}
                      className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Investigation Team Panel */}
        <Panel
          title="Investigation Team Members"
          subtitle="Collaborate with active peers within the incident department"
          icon={<Users className="w-5 h-5" />}
        >
          {!isLocked && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 border" style={{ borderColor: BORDER }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={teamInput.userId}
                  onChange={(e) => setTeamInput({ ...teamInput, userId: e.target.value })}
                  className={inputStyle}
                  style={{ borderColor: BORDER }}
                >
                  <option value="">Select department colleague…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} • {c.role}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Role in investigation"
                  value={teamInput.role}
                  onChange={(e) => setTeamInput({ ...teamInput, role: e.target.value })}
                  className={inputStyle}
                  style={{ borderColor: BORDER }}
                />
              </div>
              <button
                type="button"
                disabled={!teamInput.userId}
                onClick={() => {
                  run(
                    () =>
                      investigationApi.addTeam(incidentId, {
                        userId: Number(teamInput.userId),
                        role: teamInput.role.trim() || 'Co-Investigator',
                      }),
                    'Team member added to investigation.'
                  );
                  setTeamInput({ userId: '', role: 'Co-Investigator' });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0F1E42] hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Assign Team Member
              </button>
            </div>
          )}

          <div className="space-y-2 mt-4">
            {/* Lead Investigator */}
            <div className="p-3.5 rounded-xl border bg-slate-50 flex items-center justify-between text-xs" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="font-extrabold text-[#0F1E42]">{record.leadInvestigator?.name}</span>
                  <span className="text-slate-500 ml-1.5">(Lead Investigator)</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                LEAD
              </span>
            </div>

            {/* Additional Team Members */}
            {record.teamMembers?.map((m) => (
              <div
                key={m.userId}
                className="p-3.5 rounded-xl border bg-white flex items-center justify-between text-xs"
                style={{ borderColor: BORDER }}
              >
                <div>
                  <span className="font-bold text-slate-800">{m.user?.name}</span>
                  <span className="text-slate-500 ml-1.5">• {m.role}</span>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        () => investigationApi.removeTeam(incidentId, m.userId),
                        'Team member removed.'
                      )
                    }
                    className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Section 3: Formal Root Cause Analysis (RCA) ────────────────────── */}
      <Panel
        title="Section 3: Formal Root Cause Analysis (RCA)"
        subtitle="Mandatory structured root-cause classification and causal chain reasoning"
        icon={<Bookmark className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Root Cause Category *
            </label>
            <select
              disabled={isLocked}
              value={draft.rootCauseCategory}
              onChange={(e) => setDraft({ ...draft, rootCauseCategory: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER }}
            >
              <option value="">Select standard category…</option>
              {ROOT_CAUSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Root Cause Sub-Category *
            </label>
            <input
              type="text"
              disabled={isLocked}
              placeholder="e.g. Dose verification omission"
              value={draft.rootCauseSubcategory}
              onChange={(e) => setDraft({ ...draft, rootCauseSubcategory: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Causal Analysis Method *
            </label>
            <select
              disabled={isLocked}
              value={draft.rootCauseMethod}
              onChange={(e) =>
                setDraft({ ...draft, rootCauseMethod: e.target.value as InvestigationMethod })
              }
              className={inputStyle}
              style={{ borderColor: BORDER }}
            >
              <option value="">Select analysis method…</option>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border cursor-pointer select-none" style={{ borderColor: BORDER }}>
              <input
                type="checkbox"
                disabled={isLocked}
                checked={draft.systemicIssue}
                onChange={(e) => setDraft({ ...draft, systemicIssue: e.target.checked })}
                className="w-4 h-4 rounded text-[#0F1E42] focus:ring-[#0F1E42]"
              />
              <div>
                <span className="text-xs font-extrabold text-[#0F1E42]">
                  Flag as Hospital-Wide Systemic Issue
                </span>
                <p className="text-[11px] text-slate-500">
                  Flags this root cause for enterprise clinical governance review across multiple departments.
                </p>
              </div>
            </label>
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Primary Root-Cause Statement (Underlying Factor) *
            </label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={draft.rootCauseDescription}
              onChange={(e) => setDraft({ ...draft, rootCauseDescription: e.target.value })}
              placeholder="Synthesize the single primary root cause discovered during investigation…"
              className={`${inputStyle} resize-y leading-relaxed`}
              style={{ borderColor: BORDER }}
            />
            <div className="flex justify-between items-center text-xs mt-1 text-slate-400">
              <span>Concise, auditable statement directly supported by findings.</span>
              <span className={draft.rootCauseDescription.length >= 20 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-medium'}>
                {draft.rootCauseDescription.length} characters (min 20)
              </span>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: TEXT }}>
              Detailed Analysis & Reasoning Rationale *
            </label>
            <textarea
              rows={4}
              disabled={isLocked}
              value={draft.rootCauseDetail}
              onChange={(e) => setDraft({ ...draft, rootCauseDetail: e.target.value })}
              placeholder="Document the causal chain (e.g. 5 Whys steps, barrier analysis, why defenses failed)…"
              className={`${inputStyle} resize-y leading-relaxed`}
              style={{ borderColor: BORDER }}
            />
            <div className="flex justify-between items-center text-xs mt-1 text-slate-400">
              <span>Logical progression explaining why existing safeguards did not prevent the event.</span>
              <span className={draft.rootCauseDetail.length >= 20 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-medium'}>
                {draft.rootCauseDetail.length} characters (min 20)
              </span>
            </div>
          </div>
        </div>

        {!isLocked && (
          <div className="mt-4 pt-4 border-t flex justify-end" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => handleSaveDraft(true)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0F1E42] hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Structured RCA
            </button>
          </div>
        )}
      </Panel>

      {/* ── Section 4: Evidence, Timeline & Witnesses ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Witnesses Panel */}
        <Panel
          title="Witness Records"
          subtitle="Interviews and formal statements"
          icon={<Users className="w-4 h-4" />}
        >
          {!isLocked && (
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 border mb-4 text-xs" style={{ borderColor: BORDER }}>
              <input
                type="text"
                placeholder="Witness Full Name *"
                value={witnessInput.name}
                onChange={(e) => setWitnessInput({ ...witnessInput, name: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <input
                type="text"
                placeholder="Clinical Role / Contact Info"
                value={witnessInput.roleOrContact}
                onChange={(e) => setWitnessInput({ ...witnessInput, roleOrContact: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <textarea
                rows={2}
                placeholder="Summary of statement or testimony…"
                value={witnessInput.statement}
                onChange={(e) => setWitnessInput({ ...witnessInput, statement: e.target.value })}
                className={`${inputStyle} resize-y`}
                style={{ borderColor: BORDER }}
              />
              <input
                type="date"
                value={witnessInput.interviewedAt}
                onChange={(e) => setWitnessInput({ ...witnessInput, interviewedAt: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <button
                type="button"
                disabled={!witnessInput.name.trim()}
                onClick={() => {
                  run(
                    () => investigationApi.addWitness(incidentId, witnessInput),
                    'Witness interview recorded.'
                  );
                  setWitnessInput({ name: '', roleOrContact: '', statement: '', interviewedAt: '' });
                }}
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-[#0F1E42] hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Log Witness Interview
              </button>
            </div>
          )}

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {record.witnesses?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No witness statements recorded.</p>
            ) : (
              record.witnesses?.map((w) => (
                <div key={w.id} className="p-3 rounded-xl border bg-white space-y-1 text-xs" style={{ borderColor: BORDER }}>
                  <div className="flex justify-between items-start font-bold text-slate-800">
                    <span>{w.name}</span>
                    {w.interviewedAt && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(w.interviewedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {w.roleOrContact && <div className="text-[11px] text-slate-500">{w.roleOrContact}</div>}
                  {w.statement && <p className="text-slate-600 leading-relaxed pt-1 italic">"{w.statement}"</p>}
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Timeline Panel */}
        <Panel
          title="Timeline of Events"
          subtitle="Chronological event log"
          icon={<Clock className="w-4 h-4" />}
        >
          {!isLocked && (
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 border mb-4 text-xs" style={{ borderColor: BORDER }}>
              <input
                type="datetime-local"
                value={timelineInput.occurredAt}
                onChange={(e) => setTimelineInput({ ...timelineInput, occurredAt: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <input
                type="text"
                placeholder="Event Title *"
                value={timelineInput.title}
                onChange={(e) => setTimelineInput({ ...timelineInput, title: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <textarea
                rows={2}
                placeholder="Chronological event details…"
                value={timelineInput.description}
                onChange={(e) => setTimelineInput({ ...timelineInput, description: e.target.value })}
                className={`${inputStyle} resize-y`}
                style={{ borderColor: BORDER }}
              />
              <input
                type="text"
                placeholder="Source / Record Reference (e.g. EHR log)"
                value={timelineInput.source}
                onChange={(e) => setTimelineInput({ ...timelineInput, source: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <button
                type="button"
                disabled={!timelineInput.occurredAt || !timelineInput.title.trim()}
                onClick={() => {
                  run(
                    () => investigationApi.addTimeline(incidentId, timelineInput),
                    'Timeline event logged.'
                  );
                  setTimelineInput({ occurredAt: '', title: '', description: '', source: '' });
                }}
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-[#0F1E42] hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Log Chronological Event
              </button>
            </div>
          )}

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {record.timeline?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No chronological events logged.</p>
            ) : (
              record.timeline?.map((t) => (
                <div key={t.id} className="p-3 rounded-xl border bg-white space-y-1 text-xs" style={{ borderColor: BORDER }}>
                  <div className="flex justify-between items-start font-bold text-[#0F1E42]">
                    <span>{t.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(t.occurredAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{t.description}</p>
                  {t.source && <div className="text-[10px] text-slate-400">Ref: {t.source}</div>}
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Evidence References Panel */}
        <Panel
          title="Evidence References"
          subtitle="Artifacts and clinical records"
          icon={<Paperclip className="w-4 h-4" />}
        >
          {!isLocked && (
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 border mb-4 text-xs" style={{ borderColor: BORDER }}>
              <select
                value={evidenceInput.attachmentId}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, attachmentId: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              >
                <option value="">Link uploaded attachment (Optional)…</option>
                {inc.attachments?.map((att: any) => (
                  <option key={att.id} value={att.id}>
                    {att.fileName} ({att.fileType})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Evidence Label / Name *"
                value={evidenceInput.label}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, label: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <input
                type="text"
                placeholder="External Document Ref ID (e.g. LAB-402)"
                value={evidenceInput.reference}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, reference: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER }}
              />
              <textarea
                rows={2}
                placeholder="Audit notes or verification details…"
                value={evidenceInput.notes}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, notes: e.target.value })}
                className={`${inputStyle} resize-y`}
                style={{ borderColor: BORDER }}
              />
              <button
                type="button"
                disabled={!evidenceInput.label.trim()}
                onClick={() => {
                  run(
                    () =>
                      investigationApi.addEvidence(incidentId, {
                        ...evidenceInput,
                        attachmentId: evidenceInput.attachmentId
                          ? Number(evidenceInput.attachmentId)
                          : undefined,
                      }),
                    'Evidence reference logged.'
                  );
                  setEvidenceInput({ attachmentId: '', label: '', reference: '', notes: '' });
                }}
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-[#0F1E42] hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Attach Evidence Reference
              </button>
            </div>
          )}

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {record.evidence?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No structured evidence references logged.</p>
            ) : (
              record.evidence?.map((e) => (
                <div key={e.id} className="p-3 rounded-xl border bg-white space-y-1 text-xs" style={{ borderColor: BORDER }}>
                  <div className="flex justify-between items-start font-bold text-slate-800">
                    <span>{e.label}</span>
                    {e.reference && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {e.reference}
                      </span>
                    )}
                  </div>
                  {e.notes && <p className="text-slate-600 leading-relaxed text-[11px]">{e.notes}</p>}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* ── Clinical Decision Support & Governance Context ─────────────────── */}
      {decisionSupport && (
        <Panel
          title="Clinical Decision Support & Pattern Recognition"
          subtitle={`${decisionSupport.modelVersion} • Auditable clinical guidelines and taxonomy insights`}
          icon={<Compass className="w-5 h-5 text-blue-700" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Methodology Guidelines */}
            <div className="p-4 rounded-xl bg-slate-50 border space-y-2.5" style={{ borderColor: BORDER }}>
              <span className="font-extrabold uppercase tracking-wider text-[#0F1E42]">
                Recommended Investigation Methods
              </span>
              <div className="space-y-2">
                {decisionSupport.methodSuggestions.map((sug) => (
                  <div key={sug.method} className="p-3 rounded-lg bg-white border flex justify-between items-center" style={{ borderColor: BORDER }}>
                    <div>
                      <div className="font-bold text-slate-800">{sug.method.replaceAll('_', ' ')}</div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{sug.reason}</p>
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ ...draft, method: sug.method, rootCauseMethod: sug.method });
                          toast.success(`Adopted ${sug.method.replaceAll('_', ' ')}`);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Incident Pattern Matching */}
            <div className="p-4 rounded-xl bg-slate-50 border space-y-2.5" style={{ borderColor: BORDER }}>
              <span className="font-extrabold uppercase tracking-wider text-[#0F1E42]">
                Correlated Incidents in Same Department
              </span>
              <div className="space-y-2">
                {decisionSupport.similarIncidents.length === 0 ? (
                  <p className="text-slate-400 italic py-2">No past incident correlations in your assigned queue.</p>
                ) : (
                  decisionSupport.similarIncidents.slice(0, 3).map((sim) => (
                    <div key={sim.id} className="p-3 rounded-lg bg-white border flex justify-between items-center" style={{ borderColor: BORDER }}>
                      <div className="truncate pr-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/investigator/${sim.id}`)}
                          className="font-bold text-blue-800 hover:underline text-left truncate block"
                        >
                          #{sim.id} {sim.title}
                        </button>
                        <span className="text-[10px] text-slate-500">
                          Matched on: {sim.matchedFields.join(', ')}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {(sim.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">{decisionSupport.disclaimer}</p>
        </Panel>
      )}

      {/* ── Section 5: Submission Checklist & Gate ──────────────────────────── */}
      <Panel
        title="Section 5: Submission Gate & Clinical Governance Verification"
        subtitle="Verification checklist validating all mandatory governance fields before advancing to Manager review"
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />}
      >
        {/* Visual Checklist */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span style={{ color: TEXT }}>
              Clinical Readiness: {readiness.completedCount} of {readiness.totalCount} Requirements Satisfied
            </span>
            <span className={readiness.allReady ? 'text-emerald-700' : 'text-amber-700'}>
              {readiness.allReady ? 'Ready for Formal Submission' : 'Incomplete Clinical Governance'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                readiness.allReady ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              style={{ width: `${(readiness.completedCount / readiness.totalCount) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
            {readiness.checks.map((chk) => (
              <div
                key={chk.id}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs transition-colors ${
                  chk.ready
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {chk.ready ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="truncate">{chk.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: BORDER }}>
          <div className="text-xs text-slate-500 max-w-md">
            Submission formally signs off your findings, sets status to <strong>SUBMITTED</strong>, and
            advances incident state to <strong>UNDER_REVIEW</strong> for Department Manager sign-off.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isLocked && (
              <button
                type="button"
                onClick={() => handleSaveDraft(true)}
                disabled={mutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                Save Final Draft
              </button>
            )}

            <button
              type="button"
              disabled={isLocked || !readiness.allReady || mutation.isPending}
              onClick={handleSubmitFinal}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                record.status === 'REVISION_REQUESTED'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <Send className="w-4 h-4" />
              {record.status === 'REVISION_REQUESTED'
                ? 'Resubmit Revised Findings to Manager'
                : 'Submit Investigation to Manager'}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default InvestigatorWorkspace;