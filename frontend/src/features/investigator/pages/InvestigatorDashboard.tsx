import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  Clock,
  Users,
  Layers,
  FileText,
  Calendar,
  ChevronRight,
  CheckCircle2,
  FileEdit,
  RotateCcw,
  Send,
  Building2,
  MapPin,
  Tag,
} from 'lucide-react';
import {
  investigationApi,
  type InvestigationStatus,
} from '../api/investigation.api';

// ── Enterprise Clinical Color Tokens ─────────────────────────────────────────
const NAVY = '#1E2B5E';
const NAVY_SOFT = '#192651';
const BORDER = '#D8DCE8';
const TEXT = '#1A2447';
const BODY = '#3B4565';
const MUTED = '#6B7494';
const SURFACE = '#FFFFFF';

const InvestigatorDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvestigationStatus | ''>('');
  const [severity, setSeverity] = useState('');
  const [due, setDue] = useState<'OVERDUE' | 'NEXT_7_DAYS' | 'NO_DATE' | ''>('');

  const params: Record<string, string> = {};
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  if (severity) params.severity = severity;
  if (due) params.due = due;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['investigation-dashboard', params],
    queryFn: () => investigationApi.dashboard(params),
  });

  const summary = data?.summary ?? {
    total: 0,
    drafts: 0,
    revision: 0,
    submitted: 0,
    overdue: 0,
  };
  const items = data?.items ?? [];

  const getStatusPill = (st: InvestigationStatus) => {
    const base =
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap';
    switch (st) {
      case 'DRAFT':
        return (
          <span className={`${base} bg-slate-50 text-slate-600 border-slate-200`}>
            <FileEdit className="w-3 h-3" />
            Draft
          </span>
        );
      case 'REVISION_REQUESTED':
        return (
          <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
            <RotateCcw className="w-3 h-3" />
            Revision
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className={`${base} bg-sky-50 text-sky-700 border-sky-200`}>
            <Send className="w-3 h-3" />
            Submitted
          </span>
        );
      case 'APPROVED':
        return (
          <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      default:
        return null;
    }
  };

  const getSeverityPill = (sev: string) => {
    const map: Record<string, string> = {
      CRITICAL: 'bg-red-50 text-red-700 border-red-200',
      HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
      MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
      LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return `${map[sev] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`;
  };

  const filterStyle = {
    borderColor: BORDER,
    color: TEXT,
  };
  const filterClass =
    'w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1E2B5E]';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <div
          className="animate-spin rounded-full h-10 w-10 border-[3px] border-t-transparent"
          style={{ borderColor: `${NAVY} transparent ${NAVY} ${NAVY}` }}
        />
        <p className="text-sm font-semibold tracking-wide" style={{ color: TEXT }}>
          Loading clinical investigation records…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span>Clinical Investigation Console Offline</span>
        </div>
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Unable to synchronize assigned cases.'}
        </p>
      </div>
    );
  }

  const kpis = [
    { label: 'Total', value: summary.total, alert: false },
    { label: 'Drafts', value: summary.drafts, alert: false },
    { label: 'Revision', value: summary.revision, alert: summary.revision > 0 },
    { label: 'Submitted', value: summary.submitted, alert: false },
    { label: 'Overdue', value: summary.overdue, alert: summary.overdue > 0 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Console Header & KPI Strip ─────────────────────────────────────── */}
      <header
        className="rounded-2xl px-6 py-6 sm:px-7 sm:py-7 text-white shadow-sm"
        style={{ backgroundColor: NAVY, border: `1px solid ${NAVY_SOFT}` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          Investigation Workspace
        </p>

        <div className="mt-2 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight leading-tight">
              Investigator Dashboard
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              Review assigned cases, save a draft, and submit findings for Manager review.
            </p>
          </div>

          {/* 5 KPI metrics — value above label, right aligned */}
          <div className="flex flex-wrap items-start gap-x-7 gap-y-4 lg:pt-0.5">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="text-center min-w-[52px]">
                <div
                  className={`text-2xl font-extrabold leading-none ${
                    kpi.alert ? 'text-amber-300' : 'text-white'
                  }`}
                >
                  {kpi.value}
                </div>
                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/55">
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Filter Toolbar ─────────────────────────────────────────────────── */}
      <section
        className="rounded-xl p-3 sm:p-3.5 shadow-sm"
        style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, category, location…"
              className={`${filterClass} pl-9`}
              style={filterStyle}
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InvestigationStatus | '')}
            className={`${filterClass} md:w-52 cursor-pointer`}
            style={filterStyle}
          >
            <option value="">All investigation states</option>
            <option value="DRAFT">Draft</option>
            <option value="REVISION_REQUESTED">Revision requested</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
          </select>

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className={`${filterClass} md:w-44 cursor-pointer`}
            style={filterStyle}
          >
            <option value="">All severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <select
            value={due}
            onChange={(e) => setDue(e.target.value as typeof due)}
            className={`${filterClass} md:w-44 cursor-pointer`}
            style={filterStyle}
          >
            <option value="">All due dates</option>
            <option value="OVERDUE">Overdue</option>
            <option value="NEXT_7_DAYS">Next 7 days</option>
            <option value="NO_DATE">No date set</option>
          </select>
        </div>
      </section>

      {/* ── Assigned Investigation Queue ───────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-3.5">
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ color: TEXT }}>
              Assigned Investigation Queue
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
              Incidents currently assigned to you
            </p>
          </div>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
            style={{ backgroundColor: '#F1F3F8', color: BODY, borderColor: BORDER }}
          >
            {items.length} {items.length === 1 ? 'case' : 'cases'}
          </span>
        </div>

        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
        >
          {items.length === 0 ? (
            <div className="p-14 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold" style={{ color: TEXT }}>
                No assigned incidents found
              </h3>
              <p className="text-[13px] mt-1 max-w-md mx-auto" style={{ color: MUTED }}>
                Adjust the filters above or await assignment from your Department Manager.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: BORDER }}>
              {items.map((item) => {
                const inc = item.incident;
                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/investigator/${item.incidentId}`)}
                    className="px-5 py-4 sm:px-6 sm:py-5 transition-colors hover:bg-slate-50 cursor-pointer group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Reference chip + title + status */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className="text-[11px] font-extrabold px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#F1F3F8', color: BODY, border: `1px solid ${BORDER}` }}
                          >
                            #{inc.id}
                          </span>
                          <h3
                            className="text-[15px] font-bold truncate group-hover:text-[#2952C4] transition-colors"
                            style={{ color: TEXT }}
                          >
                            {inc.title}
                          </h3>
                          {getStatusPill(item.status)}
                          {item.overdue && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                              <Clock className="w-3 h-3" />
                              Overdue
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]"
                          style={{ color: MUTED }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold" style={{ color: BODY }}>
                              {inc.category}
                            </span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {inc.location}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {inc.department?.name ?? 'Department'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Target:{' '}
                            {item.endDate
                              ? new Date(item.endDate).toLocaleDateString()
                              : 'Not scheduled'}
                          </span>
                        </div>

                        {/* Sub-entity counters */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                          {[
                            { icon: Users, label: 'Team', value: item._count.teamMembers },
                            { icon: Layers, label: 'Factors', value: item._count.contributingFactors },
                            { icon: FileText, label: 'Evidence', value: item._count.evidence },
                            { icon: Calendar, label: 'Timeline', value: item._count.timeline },
                          ].map((chip) => (
                            <span
                              key={chip.label}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium"
                              style={{ backgroundColor: '#F7F8FA', color: BODY, border: `1px solid ${BORDER}` }}
                            >
                              <chip.icon className="w-3 h-3 text-slate-400" />
                              {chip.label} {chip.value}
                            </span>
                          ))}
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium"
                            style={{ backgroundColor: '#F7F8FA', color: BODY, border: `1px solid ${BORDER}` }}
                          >
                            Revision {item.revisionNumber}
                          </span>
                        </div>
                      </div>

                      {/* Severity + CTA */}
                      <div className="flex items-center lg:flex-col lg:items-end gap-3 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getSeverityPill(
                            inc.severity
                          )}`}
                        >
                          {inc.severity}
                        </span>
                        <span
                          className="inline-flex items-center text-[12px] font-bold transition-transform group-hover:translate-x-0.5"
                          style={{ color: NAVY }}
                        >
                          Open
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default InvestigatorDashboard;
