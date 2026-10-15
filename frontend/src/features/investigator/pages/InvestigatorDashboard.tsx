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
  Filter,
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
  type InvestigationDashboardItem,
} from '../api/investigation.api';

// ── Enterprise Clinical Color Tokens ─────────────────────────────────────────
const NAVY = '#0F1E42';
const BORDER = '#D8DCE8';
const TEXT = '#1A2447';
const MUTED = '#6B7494';
const SURFACE = '#FFFFFF';
const BG_PAGE = '#F8FAFC';

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

  const getStatusBadge = (st: InvestigationStatus) => {
    switch (st) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <FileEdit className="w-3.5 h-3.5" />
            DRAFT
          </span>
        );
      case 'REVISION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <RotateCcw className="w-3.5 h-3.5" />
            REVISION REQUESTED
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300">
            <Send className="w-3.5 h-3.5" />
            SUBMITTED
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            APPROVED
          </span>
        );
      default:
        return null;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-300 font-bold';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-300 font-semibold';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-300 font-semibold';
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-300';
    }
  };

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
      <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-red-900 space-y-2">
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

  const summary = data?.summary ?? {
    total: 0,
    drafts: 0,
    revision: 0,
    submitted: 0,
    overdue: 0,
  };

  const items: InvestigationDashboardItem[] = data?.items ?? [];

  return (
    <div className="space-y-6 pb-12" style={{ backgroundColor: BG_PAGE }}>
      {/* ── 1. Executive Console Header with 5 Clinical KPIs ─────────────────── */}
      <header
        className="rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden"
        style={{
          backgroundColor: NAVY,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white/90 border border-white/15 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Clinical Governance & Root Cause Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Investigator Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
              Conduct structured root-cause governance, interview witnesses, document evidence,
              and submit formal clinical findings for Manager review.
            </p>
          </div>

          {/* 5 KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 w-full lg:w-auto">
            {[
              {
                label: 'Total Assigned',
                value: summary.total,
                accent: 'bg-white/10 text-white',
              },
              {
                label: 'Drafts in Progress',
                value: summary.drafts,
                accent: 'bg-white/10 text-slate-200',
              },
              {
                label: 'Returned for Revision',
                value: summary.revision,
                accent: summary.revision > 0 ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30' : 'bg-white/10 text-slate-200',
              },
              {
                label: 'Submitted to Manager',
                value: summary.submitted,
                accent: 'bg-white/10 text-slate-200',
              },
              {
                label: 'Overdue Cases',
                value: summary.overdue,
                accent: summary.overdue > 0 ? 'bg-red-500/25 text-red-300 border border-red-400/30 font-bold' : 'bg-white/10 text-slate-200',
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={`rounded-xl px-3.5 py-3 text-center transition-all ${kpi.accent}`}
              >
                <div className="text-2xl font-extrabold leading-none">{kpi.value}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 mt-1.5">
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── 2. Filter Toolbar ──────────────────────────────────────────────── */}
      <section
        className="rounded-2xl p-4 sm:p-5 shadow-sm"
        style={{
          backgroundColor: SURFACE,
          border: `1.5px solid ${BORDER}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          Filter Investigation Queue
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, category, location…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#0F1E42] focus:outline-none transition-all"
              style={{ borderColor: BORDER, color: TEXT }}
            />
          </div>

          {/* Investigation State */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InvestigationStatus | '')}
            className="w-full px-3 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#0F1E42] focus:outline-none transition-all cursor-pointer bg-white"
            style={{ borderColor: BORDER, color: TEXT }}
          >
            <option value="">All investigation states</option>
            <option value="DRAFT">DRAFT</option>
            <option value="REVISION_REQUESTED">REVISION REQUESTED</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="APPROVED">APPROVED</option>
          </select>

          {/* Severity */}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#0F1E42] focus:outline-none transition-all cursor-pointer bg-white"
            style={{ borderColor: BORDER, color: TEXT }}
          >
            <option value="">All severities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          {/* Target Due Date */}
          <select
            value={due}
            onChange={(e) => setDue(e.target.value as any)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#0F1E42] focus:outline-none transition-all cursor-pointer bg-white"
            style={{ borderColor: BORDER, color: TEXT }}
          >
            <option value="">All target dates</option>
            <option value="OVERDUE">Overdue cases</option>
            <option value="NEXT_7_DAYS">Due next 7 days</option>
            <option value="NO_DATE">No target date set</option>
          </select>
        </div>
      </section>

      {/* ── 3. Assigned Queue Cards ────────────────────────────────────────── */}
      <section
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{
          backgroundColor: SURFACE,
          border: `1.5px solid ${BORDER}`,
        }}
      >
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <div>
            <h2 className="text-base sm:text-lg font-bold" style={{ color: TEXT }}>
              Assigned Investigation Queue
            </h2>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: MUTED }}>
              Incidents assigned to you for root cause determination and clinical evidence governance.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {items.length} {items.length === 1 ? 'case' : 'cases'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold" style={{ color: TEXT }}>
              No assigned incidents found
            </h3>
            <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: MUTED }}>
              No cases match your active filters. Clear search or check back when department managers
              assign new investigations.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {items.map((item) => {
              const inc = item.incident;
              const isOverdue = item.overdue;

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/investigator/${item.incidentId}`)}
                  className="p-5 sm:p-6 transition-all hover:bg-slate-50 cursor-pointer group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Main Incident Details */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          #{inc.id}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold group-hover:text-blue-700 transition-colors truncate" style={{ color: TEXT }}>
                          {inc.title}
                        </h3>
                        {getStatusBadge(item.status)}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-extrabold bg-red-100 text-red-800 border border-red-300">
                            <Clock className="w-3 h-3" />
                            OVERDUE
                          </span>
                        )}
                      </div>

                      {/* Clinical Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: MUTED }}>
                        <span className="inline-flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-700 font-semibold">{inc.category}</strong>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inc.location}</span>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inc.department?.name ?? 'Department'}</span>
                        </span>
                      </div>

                      {/* Entity Counters Chips */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          <Users className="w-3 h-3 text-slate-500" />
                          Team ({item._count.teamMembers})
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          <Layers className="w-3 h-3 text-slate-500" />
                          Factors ({item._count.contributingFactors})
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          <FileText className="w-3 h-3 text-slate-500" />
                          Evidence ({item._count.evidence})
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          Timeline ({item._count.timeline})
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          Revision ({item.revisionNumber})
                        </span>
                      </div>
                    </div>

                    {/* Right Severity & Action Column */}
                    <div className="flex items-center lg:flex-col lg:items-end justify-between gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                        <span
                          className={`px-3 py-1 rounded-md text-xs border tracking-wider ${getSeverityBadge(
                            inc.severity
                          )}`}
                        >
                          {inc.severity} SEVERITY
                        </span>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Target:{' '}
                            {item.endDate
                              ? new Date(item.endDate).toLocaleDateString()
                              : 'Not scheduled'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center text-xs font-bold text-[#0F1E42] group-hover:translate-x-0.5 transition-transform">
                        <span>Open Workspace</span>
                        <ChevronRight className="w-4 h-4 ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default InvestigatorDashboard;