import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  ClipboardList,
  Filter,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMyIncidents } from '../hooks/useStaff';
import { useAuthContext } from '../../auth/context/AuthContext';
import type { StaffIncidentItem } from '../types/staff.types';

export const MyIncidentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  // Strictly fetch staff incidents (Lightweight staff summary + items, NO manager analytics)
  const { data, isLoading, isError, error, refetch, isFetching } = useMyIncidents();

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const summary = data?.summary ?? {
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
  };

  const items = data?.items ?? [];

  // Filtered incidents logic
  const filteredIncidents = useMemo(() => {
    return items.filter((item: StaffIncidentItem) => {
      // 1. Search filter: referenceId, title, location
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.referenceId.toLowerCase().includes(query) ||
        String(item.id).includes(query) ||
        (item.location && item.location.toLowerCase().includes(query));

      // 2. Status filter
      const matchesStatus =
        statusFilter === 'ALL' || item.status.toUpperCase() === statusFilter.toUpperCase();

      // 3. Severity filter
      const matchesSeverity =
        severityFilter === 'ALL' || item.severity.toUpperCase() === severityFilter.toUpperCase();

      // 4. Date range filter
      let matchesDate = true;
      if (startDate || endDate) {
        const itemDate = new Date(item.reportedAt).getTime();
        if (startDate) {
          const fromTime = new Date(startDate).setHours(0, 0, 0, 0);
          if (itemDate < fromTime) matchesDate = false;
        }
        if (endDate) {
          const toTime = new Date(endDate).setHours(23, 59, 59, 999);
          if (itemDate > toTime) matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesSeverity && matchesDate;
    });
  }, [items, searchTerm, statusFilter, severityFilter, startDate, endDate]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    statusFilter !== 'ALL' ||
    severityFilter !== 'ALL' ||
    Boolean(startDate) ||
    Boolean(endDate);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Severity Badges (Clinical Healthcare standard)
  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            Medium
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            Low
          </span>
        );
    }
  };

  // Workflow Status Badges (Clinical Standard)
  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-300">
            {status === 'OPEN' ? 'Under Triage' : 'Accepted'}
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 border border-purple-200">
            Investigating
          </span>
        );
      case 'PENDING_ACTION':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
            Action Pending
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-cyan-50 text-cyan-800 border border-cyan-200">
            Under Review
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
            Closed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
            {status?.replace(/_/g, ' ') || 'Unknown'}
          </span>
        );
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* ── 1. Header Section ────────────────────────────────────────── */}
      <div className="bg-[#0F1E42] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-blue-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-300" />
            STAFF SAFETY WORKSPACE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            My Reported Incidents
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Track status, investigation progress, and corrective actions for safety events you submitted.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            title="Refresh incident list"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/submit-incident')}
            className="px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Report New Incident</span>
          </button>
        </div>
      </div>

      {/* ── 2. Staff Metric Cards (Top Row - 4 Cards) ───────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reported */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Reported
            </span>
            <ClipboardList className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {isLoading ? '—' : summary.total}
            </span>
            <span className="text-xs text-slate-500 font-medium">all-time records</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Submitted under your staff profile
          </p>
        </div>

        {/* Under Triage / Open */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Under Triage / Open
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {isLoading ? '—' : summary.open}
            </span>
            <span className="text-xs text-slate-500 font-medium">awaiting triage</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Pending initial manager decision
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              In Progress
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-700">
              {isLoading ? '—' : summary.inProgress}
            </span>
            <span className="text-xs text-purple-600 font-medium">active workflow</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Investigation or corrective action underway
          </p>
        </div>

        {/* Resolved / Closed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Resolved / Closed
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700">
              {isLoading ? '—' : summary.closed}
            </span>
            <span className="text-xs text-emerald-600 font-medium">completed</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Audited and formally closed records
          </p>
        </div>
      </div>

      {/* ── 3. Search & Filter Bar ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Reference ID, Title, or Location..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-white rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer transition-colors"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open / Triage</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="PENDING_ACTION">Pending Action</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="md:col-span-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-white rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer transition-colors"
            >
              <option value="ALL">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Date Picker Row */}
          <div className="md:col-span-3 flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 px-2 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              title="From date"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 px-2 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              title="To date"
            />
          </div>
        </div>

        {/* Filter Summary / Clear Bar */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Showing <strong>{filteredIncidents.length}</strong> of{' '}
                <strong>{items.length}</strong> incident reports
              </span>
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Incident Register Table ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-600">
              Loading your safety reports registry...
            </p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-8">
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-red-900">
                  Unable to load staff incident register
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  {error instanceof Error ? error.message : 'Please check your connection and try again.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-2 text-xs font-bold text-red-800 underline hover:no-underline cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State (No records at all) */}
        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-4 border border-blue-100">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No safety incidents recorded under your profile
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
              No safety incidents recorded under your profile. Use '+ Report Incident' to submit a new clinical observation or event.
            </p>
            <button
              type="button"
              onClick={() => navigate('/submit-incident')}
              className="mt-5 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-[#0F1E42] hover:bg-[#1E293B] shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Report First Incident</span>
            </button>
          </div>
        )}

        {/* Filtered Empty State (No records match filters) */}
        {!isLoading && !isError && items.length > 0 && filteredIncidents.length === 0 && (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <Search className="w-8 h-8 text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No matching incident reports</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              No reports match your active search and filter parameters.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Incident Table */}
        {!isLoading && !isError && filteredIncidents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Reference ID</th>
                  <th className="px-5 py-3.5">Incident Title &amp; Category</th>
                  <th className="px-5 py-3.5">Department &amp; Location</th>
                  <th className="px-5 py-3.5">Severity</th>
                  <th className="px-5 py-3.5">Workflow Status</th>
                  <th className="px-5 py-3.5">Reported Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredIncidents.map((incident) => {
                  return (
                    <tr
                      key={incident.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      {/* Reference / ID */}
                      <td className="px-5 py-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {incident.referenceId || `#INC-${incident.id}`}
                      </td>

                      {/* Incident Title & Category */}
                      <td className="px-5 py-4 max-w-sm">
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                          {incident.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                          <span>{incident.category}</span>
                          {incident.subcategory && (
                            <>
                              <span className="text-slate-300">&rsaquo;</span>
                              <span className="text-slate-600 font-medium">
                                {incident.subcategory}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Department & Location */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {incident.department?.name || 'Assigned Department'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                          {incident.location || 'Hospital Location'}
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getSeverityBadge(incident.severity)}
                      </td>

                      {/* Workflow Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getStatusBadge(incident.status)}
                      </td>

                      {/* Reported Date */}
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {formatDateTime(incident.reportedAt)}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incidents/${incident.id}`);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info bar */}
        {!isLoading && !isError && filteredIncidents.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <div>
              Staff profile: <strong>{user?.name || 'Logged Staff Member'}</strong> &bull; Incident logs are immutable and tracked for clinical governance.
            </div>
            <div>
              Showing {filteredIncidents.length} record(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyIncidentsPage;