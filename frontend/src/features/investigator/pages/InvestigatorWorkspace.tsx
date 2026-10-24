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
  AlertCircle,
  Check,
  Send,
  Save,
} from 'lucide-react';
import {
  investigationApi,
  type InvestigationMethod,
} from '../api/investigation.api';

// ── Enterprise Clinical Color Tokens ─────────────────────────────────────────
const NAVY = '#1E2B5E';
const NAVY_SOFT = '#192651';
const BORDER = '#D8DCE8';
const TEXT = '#1A2447';
const BODY = '#3B4565';
const MUTED = '#6B7494';
const SURFACE = '#FFFFFF';

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
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, children, className = '', actions }) => (
  <section
    className={`rounded-xl p-5 sm:p-6 shadow-sm ${className}`}
    style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
  >
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-[15px] sm:text-base font-bold tracking-tight" style={{ color: TEXT }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions}
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
  const { data: record, isLoading, isError, error } = useQuery({
    queryKey: ['investigation-workspace', incidentId],
    queryFn: () => investigationApi.workspace(incidentId),
    enabled: Number.isInteger(incidentId) && incidentId > 0,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['investigation-candidates', incidentId],
    queryFn: () => investigationApi.candidates(incidentId),
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

  // ── Draft Payload ──────────────────────────────────────────────────────────
  const draftPayload = () => ({
    ...draft,
    startDate: draft.startDate || null,
    endDate: draft.endDate || null,
    method: draft.method || null,
    methodOther: draft.method === 'OTHER' ? draft.methodOther : null,
    rootCauseMethod: draft.rootCauseMethod || null,
    contributingFactors: factors,
  });

  // ── Save Draft Action ──────────────────────────────────────────────────────
  const handleSaveDraft = (notify = true) => {
    run(
      () => investigationApi.saveDraft(incidentId, draftPayload()),
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
      async () => {
        await investigationApi.saveDraft(incidentId, draftPayload());
        return investigationApi.submit(incidentId);
      },
      record?.status === 'REVISION_REQUESTED'
        ? 'Revised findings successfully submitted for Manager review.'
        : 'Investigation successfully submitted to Manager.'
    );
  };

  // ── Readiness Checklist Calculation ────────────────────────────────────────
  const readiness = useMemo(() => {
    const checks = [
      { id: 'start_date', label: 'Investigation start date specified', ready: Boolean(draft.startDate) },
      {
        id: 'method',
        label: 'Investigation methodology selected',
        ready: Boolean(draft.method && (draft.method !== 'OTHER' || draft.methodOther.trim())),
      },
      {
        id: 'findings',
        label: 'Findings narrative documented (min 20 chars)',
        ready: Boolean(draft.findingsSummary && draft.findingsSummary.trim().length >= 20),
      },
      { id: 'factors', label: 'At least 1 contributing factor recorded', ready: factors.length > 0 },
      {
        id: 'rca_category',
        label: 'Root-cause category and sub-category categorized',
        ready: Boolean(draft.rootCauseCategory.trim() && draft.rootCauseSubcategory.trim()),
      },
      { id: 'rca_method', label: 'Root-cause analysis method chosen', ready: Boolean(draft.rootCauseMethod) },
      {
        id: 'rca_statement',
        label: 'Root-cause statement documented (min 20 chars)',
        ready: Boolean(draft.rootCauseDescription && draft.rootCauseDescription.trim().length >= 20),
      },
      {
        id: 'rca_detail',
        label: 'In-depth causal reasoning logged (min 20 chars)',
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
      <div className="p-8 rounded-xl border border-red-200 bg-red-50 text-red-900 space-y-4 text-center max-w-xl mx-auto my-12">
        <AlertCircle className="w-10 h-10 mx-auto text-red-600" />
        <h2 className="text-xl font-bold">Investigation Record Inaccessible</h2>
        <p className="text-sm text-red-600">
          {error instanceof Error
            ? error.message
            : 'This incident is not assigned to you or you lack the required investigator privileges.'}
        </p>
        <button
          onClick={() => navigate('/investigator')}
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer"
          style={{ backgroundColor: NAVY }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isLocked = ['SUBMITTED', 'APPROVED'].includes(record.status);
  const overdue =
    !isLocked && !!record.endDate && new Date(record.endDate).getTime() < Date.now();
  const inc = record.incident;
  const inputStyle =
    'w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1E2B5E] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
  const labelStyle = 'block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5';
  const btnNavy =
    'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold text-white transition-colors disabled:opacity-40 cursor-pointer';
  const btnOutline =
    'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-colors cursor-pointer border';

  return (
    <div className="space-y-6 pb-12">
      {/* ── Back navigation ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/investigator')}
          className="inline-flex items-center gap-2 text-[12px] font-bold transition-colors cursor-pointer"
          style={{ color: NAVY }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assigned Investigation Queue
        </button>

        {!isLocked && (
          <button
            onClick={() => handleSaveDraft(true)}
            disabled={mutation.isPending}
            className={`${btnOutline} bg-white hover:bg-slate-50 disabled:opacity-50`}
            style={{ borderColor: BORDER, color: BODY }}
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
        )}
      </div>

      {/* ── Investigation Header ───────────────────────────────────────────── */}
      <header
        className="rounded-2xl px-6 py-7 sm:px-7 text-white shadow-sm"
        style={{ backgroundColor: NAVY, border: `1px solid ${NAVY_SOFT}` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          Investigation #{record.id} &nbsp;•&nbsp; Incident #{inc.id}
        </p>

        <h1 className="mt-2 text-[24px] sm:text-[28px] font-extrabold tracking-tight leading-tight">
          {inc.title}
        </h1>

        <p className="mt-2.5 text-[13px] leading-relaxed text-white/70 max-w-4xl">
          {inc.description}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] bg-white/12 border border-white/20">
            {record.status.replaceAll('_', ' ')}
          </span>
          {overdue && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] bg-red-500/25 border border-red-400/40 text-red-200">
              Overdue
            </span>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-white/55">
          <span>Revision {record.revisionNumber}</span>
          <span className="text-white/25">•</span>
          <span
            className={
              inc.severity === 'CRITICAL'
                ? 'text-red-300 font-bold'
                : inc.severity === 'HIGH'
                ? 'text-orange-300 font-bold'
                : 'text-white/70'
            }
          >
            {inc.severity}
          </span>
          <span className="text-white/25">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Target completion:{' '}
            {record.endDate ? new Date(record.endDate).toLocaleDateString() : 'Unscheduled'}
          </span>
        </div>
      </header>

      {/* ── Revision / Lock Banner ─────────────────────────────────────────── */}
      {record.status === 'REVISION_REQUESTED' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[13px] font-bold text-amber-900">
              Revision requested — Revision #{record.revisionNumber}
            </h3>
            <p className="text-[12px] text-amber-800 leading-relaxed mt-0.5">
              <span className="font-semibold">Manager feedback:</span>{' '}
              {inc.investigationReviewComment ||
                'The findings require clarification or additional evidence prior to sign-off.'}
            </p>
          </div>
        </div>
      )}

      {isLocked && (
        <div
          className="rounded-xl px-5 py-4 flex items-start gap-3 shadow-sm"
          style={{ backgroundColor: '#F1F3F8', border: `1px solid ${BORDER}` }}
        >
          <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: MUTED }} />
          <p className="text-[12px] leading-relaxed" style={{ color: BODY }}>
            {record.status === 'APPROVED'
              ? 'Approved findings are locked. Draft controls are read-only until a revision is requested.'
              : 'Findings have been submitted and are pending Manager review. Draft controls are read-only until returned for revision.'}
          </p>
        </div>
      )}

      {/* ── Incident Context ───────────────────────────────────────────────── */}
      <section
        className="rounded-xl grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x shadow-sm"
        style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderColor: BORDER }}
      >
        {[
          {
            label: 'Reporter',
            value: inc.reporter?.name ?? 'Anonymous Staff',
            sub: inc.reporter?.email,
          },
          {
            label: 'Department',
            value: inc.department?.name ?? 'N/A',
            sub: `Category: ${inc.category}`,
          },
          {
            label: 'Location',
            value: inc.location,
            sub: `Logged: ${new Date(inc.createdAt).toLocaleString()}`,
          },
        ].map((meta) => (
          <div key={meta.label} className="px-5 py-4" style={{ borderColor: BORDER }}>
            <span className={labelStyle} style={{ color: MUTED }}>
              {meta.label}
            </span>
            <div className="text-[13px] font-bold truncate" style={{ color: TEXT }}>
              {meta.value}
            </div>
            {meta.sub && (
              <div className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>
                {meta.sub}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Investigation Plan & Draft ─────────────────────────────────────── */}
      <Panel
        title="Investigation Plan & Draft"
        subtitle="Save incomplete work without advancing incident state"
        actions={
          !isLocked ? (
            <button
              onClick={() => handleSaveDraft(true)}
              disabled={mutation.isPending}
              className={btnNavy}
              style={{ backgroundColor: NAVY }}
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelStyle} style={{ color: TEXT }}>
              Start date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              disabled={isLocked}
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          <div>
            <label className={labelStyle} style={{ color: TEXT }}>
              Target / end date
            </label>
            <input
              type="date"
              disabled={isLocked}
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          <div>
            <label className={labelStyle} style={{ color: TEXT }}>
              Investigation method <span className="text-red-500">*</span>
            </label>
            <select
              disabled={isLocked}
              value={draft.method}
              onChange={(e) => setDraft({ ...draft, method: e.target.value as InvestigationMethod | '' })}
              className={`${inputStyle} cursor-pointer`}
              style={{ borderColor: BORDER, color: TEXT }}
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
            <label className={labelStyle} style={{ color: TEXT }}>
              Other method
            </label>
            <input
              type="text"
              disabled={isLocked || draft.method !== 'OTHER'}
              placeholder="Specify methodology"
              value={draft.methodOther}
              onChange={(e) => setDraft({ ...draft, methodOther: e.target.value })}
              className={inputStyle}
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-4">
            <label className={labelStyle} style={{ color: TEXT }}>
              Findings summary <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              disabled={isLocked}
              placeholder="Objective, factual observations supported by clinical records…"
              value={draft.findingsSummary}
              onChange={(e) => setDraft({ ...draft, findingsSummary: e.target.value })}
              className={`${inputStyle} resize-y`}
              style={{ borderColor: BORDER, color: TEXT }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px]" style={{ color: MUTED }}>
                Objective, factual observations supported by clinical records.
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  draft.findingsSummary.trim().length >= 20 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {draft.findingsSummary.trim().length} characters (min 20)
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Contributing Factors | Investigation Team ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Contributing Factors"
          subtitle="Record multiple validated factors for clustering and prediction"
        >
          {!isLocked && (
            <div className="space-y-2.5 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Category"
                  value={newFactor.category}
                  onChange={(e) => setNewFactor({ ...newFactor, category: e.target.value })}
                  className={inputStyle}
                  style={{ borderColor: BORDER, color: TEXT }}
                />
                <input
                  type="text"
                  placeholder="Description of contributing factor"
                  value={newFactor.description}
                  onChange={(e) => setNewFactor({ ...newFactor, description: e.target.value })}
                  className={`${inputStyle} sm:col-span-2`}
                  style={{ borderColor: BORDER, color: TEXT }}
                />
              </div>
              <button
                type="button"
                disabled={!newFactor.category.trim() || !newFactor.description.trim()}
                onClick={() => {
                  setFactors([...factors, newFactor]);
                  setNewFactor({ category: '', description: '' });
                }}
                className={btnNavy}
                style={{ backgroundColor: NAVY }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contributing Factor
              </button>
            </div>
          )}

          <div className="space-y-2">
            {factors.length === 0 ? (
              <p className="text-[12px] italic py-2" style={{ color: MUTED }}>
                No contributing factors logged yet. At least one is required for formal submission.
              </p>
            ) : (
              factors.map((f, idx) => (
                <div
                  key={`${f.category}-${idx}`}
                  className="px-3.5 py-2.5 rounded-lg border flex items-start justify-between gap-3 text-[12px]"
                  style={{ borderColor: BORDER }}
                >
                  <div className="leading-relaxed">
                    <span className="font-bold" style={{ color: TEXT }}>
                      {f.category}
                    </span>
                    <span style={{ color: MUTED }}> — </span>
                    <span style={{ color: BODY }}>{f.description}</span>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => setFactors(factors.filter((_, i) => i !== idx))}
                      className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="Investigation Team"
          subtitle="Eligible active colleagues from the same department"
        >
          {!isLocked && (
            <div className="space-y-2.5 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={teamInput.userId}
                  onChange={(e) => setTeamInput({ ...teamInput, userId: e.target.value })}
                  className={`${inputStyle} cursor-pointer`}
                  style={{ borderColor: BORDER, color: TEXT }}
                >
                  <option value="">Select member</option>
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
                  style={{ borderColor: BORDER, color: TEXT }}
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
                className={btnNavy}
                style={{ backgroundColor: NAVY }}
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Team Member
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div
              className="px-3.5 py-2.5 rounded-lg border flex items-center justify-between text-[12px]"
              style={{ borderColor: BORDER, backgroundColor: '#F7F8FA' }}
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold" style={{ color: TEXT }}>
                  {record.leadInvestigator?.name}
                </span>
                <span style={{ color: MUTED }}>Lead Investigator</span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wider">
                LEAD
              </span>
            </div>

            {record.teamMembers?.map((m) => (
              <div
                key={m.userId}
                className="px-3.5 py-2.5 rounded-lg border flex items-center justify-between text-[12px]"
                style={{ borderColor: BORDER }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEXT }}>
                    {m.user?.name}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded tracking-wider bg-slate-50 text-slate-600 border border-slate-200">
                    {m.role}
                  </span>
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
                    className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {record.teamMembers?.length === 0 && (
              <p className="text-[12px] italic py-1" style={{ color: MUTED }}>
                No additional team members assigned.
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Complete Root Cause Analysis ───────────────────────────────────── */}
      <Panel
        title="Complete Root Cause Analysis"
        subtitle="Category, sub-category, description, method and analysis detail are required for submission"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelStyle} style={{ color: TEXT }}>
                Root-cause category <span className="text-red-500">*</span>
              </label>
              <select
                disabled={isLocked}
                value={draft.rootCauseCategory}
                onChange={(e) => setDraft({ ...draft, rootCauseCategory: e.target.value })}
                className={`${inputStyle} cursor-pointer`}
                style={{ borderColor: BORDER, color: TEXT }}
              >
                <option value="">Select category…</option>
                {ROOT_CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelStyle} style={{ color: TEXT }}>
                Sub-category <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="e.g. Dose verification omission"
                value={draft.rootCauseSubcategory}
                onChange={(e) => setDraft({ ...draft, rootCauseSubcategory: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className={labelStyle} style={{ color: TEXT }}>
                Analysis method <span className="text-red-500">*</span>
              </label>
              <select
                disabled={isLocked}
                value={draft.rootCauseMethod}
                onChange={(e) =>
                  setDraft({ ...draft, rootCauseMethod: e.target.value as InvestigationMethod | '' })
                }
                className={`${inputStyle} cursor-pointer`}
                style={{ borderColor: BORDER, color: TEXT }}
              >
                <option value="">Select method…</option>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <label
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border cursor-pointer select-none md:mt-[22px]"
              style={{ borderColor: BORDER, color: TEXT }}
            >
              <input
                type="checkbox"
                disabled={isLocked}
                checked={draft.systemicIssue}
                onChange={(e) => setDraft({ ...draft, systemicIssue: e.target.checked })}
                className="w-4 h-4 rounded"
                style={{ accentColor: NAVY }}
              />
              <span className="text-[12px] font-semibold">Flag as systemic issue</span>
            </label>
          </div>

          <div>
            <label className={labelStyle} style={{ color: TEXT }}>
              Primary root-cause statement <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              disabled={isLocked}
              placeholder="State the underlying cause identified through the selected method…"
              value={draft.rootCauseDescription}
              onChange={(e) => setDraft({ ...draft, rootCauseDescription: e.target.value })}
              className={`${inputStyle} resize-y`}
              style={{ borderColor: BORDER, color: TEXT }}
            />
            <div className="flex justify-end mt-1">
              <span
                className={`text-[11px] font-semibold ${
                  draft.rootCauseDescription.trim().length >= 20 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {draft.rootCauseDescription.trim().length} characters (min 20)
              </span>
            </div>
          </div>

          <div>
            <label className={labelStyle} style={{ color: TEXT }}>
              Detailed analysis &amp; reasoning <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              disabled={isLocked}
              placeholder="Document the causal chain and supporting evidence…"
              value={draft.rootCauseDetail}
              onChange={(e) => setDraft({ ...draft, rootCauseDetail: e.target.value })}
              className={`${inputStyle} resize-y`}
              style={{ borderColor: BORDER, color: TEXT }}
            />
            <div className="flex justify-end mt-1">
              <span
                className={`text-[11px] font-semibold ${
                  draft.rootCauseDetail.trim().length >= 20 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {draft.rootCauseDetail.trim().length} characters (min 20)
              </span>
            </div>
          </div>

          {!isLocked && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => handleSaveDraft(true)}
                disabled={mutation.isPending}
                className={btnNavy}
                style={{ backgroundColor: NAVY }}
              >
                <Save className="w-3.5 h-3.5" />
                Save Structured RCA
              </button>
            </div>
          )}
        </div>
      </Panel>

      {/* ── Witnesses | Timeline | Evidence ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Witness Records" subtitle="Interviews and formal statements">
          {!isLocked && (
            <div className="space-y-2 mb-4">
              <input
                type="text"
                placeholder="Witness name *"
                value={witnessInput.name}
                onChange={(e) => setWitnessInput({ ...witnessInput, name: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                type="text"
                placeholder="Clinical role / contact"
                value={witnessInput.roleOrContact}
                onChange={(e) => setWitnessInput({ ...witnessInput, roleOrContact: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <textarea
                rows={2}
                placeholder="Summary of statement or testimony…"
                value={witnessInput.statement}
                onChange={(e) => setWitnessInput({ ...witnessInput, statement: e.target.value })}
                className={`${inputStyle} resize-y`}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                type="date"
                value={witnessInput.interviewedAt}
                onChange={(e) => setWitnessInput({ ...witnessInput, interviewedAt: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
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
                className={`${btnNavy} w-full`}
                style={{ backgroundColor: NAVY }}
              >
                Log Witness Interview
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {!record.witnesses?.length ? (
              <p className="text-[12px] italic" style={{ color: MUTED }}>
                No witness statements recorded.
              </p>
            ) : (
              record.witnesses.map((w) => (
                <div
                  key={w.id}
                  className="px-3.5 py-2.5 rounded-lg border space-y-1 text-[12px]"
                  style={{ borderColor: BORDER }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold" style={{ color: TEXT }}>
                      {w.name}
                    </span>
                    {w.interviewedAt && (
                      <span className="text-[10px] shrink-0" style={{ color: MUTED }}>
                        {new Date(w.interviewedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {w.roleOrContact && (
                    <div className="text-[11px]" style={{ color: MUTED }}>
                      {w.roleOrContact}
                    </div>
                  )}
                  {w.statement && (
                    <p className="italic leading-relaxed" style={{ color: BODY }}>
                      “{w.statement}”
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Timeline of Events" subtitle="Chronological event log">
          {!isLocked && (
            <div className="space-y-2 mb-4">
              <input
                type="datetime-local"
                value={timelineInput.occurredAt}
                onChange={(e) => setTimelineInput({ ...timelineInput, occurredAt: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                type="text"
                placeholder="Event title *"
                value={timelineInput.title}
                onChange={(e) => setTimelineInput({ ...timelineInput, title: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <textarea
                rows={2}
                placeholder="Chronological event details…"
                value={timelineInput.description}
                onChange={(e) => setTimelineInput({ ...timelineInput, description: e.target.value })}
                className={`${inputStyle} resize-y`}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                type="text"
                placeholder="Source / record reference"
                value={timelineInput.source}
                onChange={(e) => setTimelineInput({ ...timelineInput, source: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
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
                className={`${btnNavy} w-full`}
                style={{ backgroundColor: NAVY }}
              >
                Log Chronological Event
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {!record.timeline?.length ? (
              <p className="text-[12px] italic" style={{ color: MUTED }}>
                No chronological events logged.
              </p>
            ) : (
              record.timeline.map((t) => (
                <div
                  key={t.id}
                  className="px-3.5 py-2.5 rounded-lg border space-y-1 text-[12px]"
                  style={{ borderColor: BORDER }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold" style={{ color: TEXT }}>
                      {t.title}
                    </span>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: MUTED }}>
                      {new Date(t.occurredAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="leading-relaxed" style={{ color: BODY }}>
                    {t.description}
                  </p>
                  {t.source && (
                    <div className="text-[10px]" style={{ color: MUTED }}>
                      Ref: {t.source}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Evidence References" subtitle="Artifacts and clinical records">
          {!isLocked && (
            <div className="space-y-2 mb-4">
              <select
                value={evidenceInput.attachmentId}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, attachmentId: e.target.value })}
                className={`${inputStyle} cursor-pointer`}
                style={{ borderColor: BORDER, color: TEXT }}
              >
                <option value="">Link uploaded attachment (optional)…</option>
                {inc.attachments?.map((att) => (
                  <option key={att.id} value={att.id}>
                    {att.fileName} ({att.fileType})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Evidence label / name *"
                value={evidenceInput.label}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, label: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <input
                type="text"
                placeholder="External reference (e.g. LAB-402)"
                value={evidenceInput.reference}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, reference: e.target.value })}
                className={inputStyle}
                style={{ borderColor: BORDER, color: TEXT }}
              />
              <textarea
                rows={2}
                placeholder="Audit notes or verification details…"
                value={evidenceInput.notes}
                onChange={(e) => setEvidenceInput({ ...evidenceInput, notes: e.target.value })}
                className={`${inputStyle} resize-y`}
                style={{ borderColor: BORDER, color: TEXT }}
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
                className={`${btnNavy} w-full`}
                style={{ backgroundColor: NAVY }}
              >
                Attach Evidence Reference
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {!record.evidence?.length ? (
              <p className="text-[12px] italic" style={{ color: MUTED }}>
                No structured evidence references logged.
              </p>
            ) : (
              record.evidence.map((e) => (
                <div
                  key={e.id}
                  className="px-3.5 py-2.5 rounded-lg border space-y-1 text-[12px]"
                  style={{ borderColor: BORDER }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold" style={{ color: TEXT }}>
                      {e.label}
                    </span>
                    {e.reference && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0"
                        style={{ backgroundColor: '#F1F3F8', color: BODY, border: `1px solid ${BORDER}` }}
                      >
                        {e.reference}
                      </span>
                    )}
                  </div>
                  {e.notes && (
                    <p className="text-[11px] leading-relaxed" style={{ color: BODY }}>
                      {e.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* ── Submit for Manager Review ──────────────────────────────────────── */}
      <Panel
        title="Submit for Manager Review"
        subtitle="Submission validates all required fields and locks findings until approval or revision request"
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span style={{ color: TEXT }}>
                Clinical readiness: {readiness.completedCount} of {readiness.totalCount} requirements
                satisfied
              </span>
              <span className={readiness.allReady ? 'text-emerald-600' : 'text-amber-600'}>
                {readiness.allReady ? 'Ready for formal submission' : 'Incomplete governance'}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-300 ${
                  readiness.allReady ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
                style={{
                  width: `${(readiness.completedCount / readiness.totalCount) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {readiness.checks.map((chk) => (
              <div
                key={chk.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] ${
                  chk.ready
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {chk.ready ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className="truncate">{chk.label}</span>
              </div>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t"
            style={{ borderColor: BORDER }}
          >
            <p className="text-[11px] max-w-md leading-relaxed" style={{ color: MUTED }}>
              Submission signs off findings, sets status to <strong>SUBMITTED</strong>, and advances the
              incident to <strong>UNDER REVIEW</strong> for Department Manager sign-off.
            </p>
            <div className="flex items-center gap-2.5">
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => handleSaveDraft(true)}
                  disabled={mutation.isPending}
                  className={`${btnOutline} bg-white hover:bg-slate-50`}
                  style={{ borderColor: BORDER, color: BODY }}
                >
                  Save Final Draft
                </button>
              )}
              <button
                type="button"
                disabled={isLocked || !readiness.allReady || mutation.isPending}
                onClick={handleSubmitFinal}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-bold text-white transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  record.status === 'REVISION_REQUESTED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                {record.status === 'REVISION_REQUESTED'
                  ? 'Resubmit Revised Findings'
                  : 'Submit Investigation to Manager'}
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default InvestigatorWorkspace;
