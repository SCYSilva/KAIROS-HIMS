// frontend/src/features/manager/pages/IncidentsList.tsx

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDepartmentIncidents } from '../../incidents/hooks/useIncidents';
import { useAuthContext } from '../../auth/context/AuthContext';
import type { Incident } from '../../incidents/types/incident';
import {
  Search,
  Download,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

/**
 * Incident Register Component for Department Managers
 * Provides multi-criteria searching, status/severity filtering, dynamic sorting,
 * client-side pagination, and CSV data export for clinical governance auditing.
 */
export const IncidentsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const departmentId = user?.departmentId ?? 1;

  // ── 1. Filter and Pagination States ─────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('NEWEST');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Fetch all incidents for this department via the core domain query hook
  const { data: incidents, isLoading, isError, error } = useDepartmentIncidents(departmentId);

  // ── 2. Dynamic Categories Derivation ─────────────────────────────────────────
  const categories = useMemo(() => {
    if (!incidents) return [];
    const uniqueCats = Array.from(new Set(incidents.map((i) => i.category).filter(Boolean)));
    return uniqueCats.sort();
  }, [incidents]);

  // ── 3. Multi-Criteria Filtering & Sorting Logic ─────────────────────────────
  const filteredAndSortedIncidents = useMemo(() => {
    if (!incidents) return [];

    // Filter by search query, status, severity, and category
    const result = incidents.filter((incident: Incident) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        incident.title.toLowerCase().includes(searchLower) ||
        incident.id.toString().includes(searchLower) ||
        incident.location?.toLowerCase().includes(searchLower) ||
        Boolean(incident.reporter?.name?.toLowerCase().includes(searchLower));

      const matchesStatus = statusFilter === 'ALL' || incident.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || incident.severity === severityFilter;
      const matchesCategory = categoryFilter === 'ALL' || incident.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesSeverity && matchesCategory;
    });

    // Apply selected sorting criteria
    return result.sort((a, b) => {
      switch (sortOrder) {
        case 'OLDEST':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'SEVERITY_DESC': {
          const weights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (weights[b.severity] || 0) - (weights[a.severity] || 0);
        }
        case 'SEVERITY_ASC': {
          const weights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (weights[a.severity] || 0) - (weights[b.severity] || 0);
        }
        case 'NEWEST':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [incidents, searchTerm, statusFilter, severityFilter, categoryFilter, sortOrder]);

  // ── 4. Client-side Pagination Slicing ────────────────────────────────────────
  const totalRecords = filteredAndSortedIncidents.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedIncidents = filteredAndSortedIncidents.slice(startIndex, endIndex);

  // ── 5. CSV Export Engine ───────────────────────────────────────────────────
  const generateCSVData = () => {
    if (!filteredAndSortedIncidents || filteredAndSortedIncidents.length === 0) return '';
    const headers = ['ID', 'Title', 'Severity', 'Status', 'Category', 'Location', 'Reporter', 'Reported Date'];
    const rows = filteredAndSortedIncidents.map((i: Incident) => [
      i.id,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.severity,
      i.status,
      i.category,
      `"${(i.location || '').replace(/"/g, '""')}"`,
      `"${(i.reporter?.name || 'Unknown').replace(/"/g, '""')}"`,
      new Date(i.createdAt).toISOString().split('T')[0],
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  const getCSVExportData = () => {
    const csvContent = generateCSVData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    return {
      href: url,
      filename: `incident-register-dept-${departmentId}-${new Date().toISOString().split('T')[0]}.csv`,
    };
  };

  const csvExport = getCSVExportData();

  const handleExportCSV = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (filteredAndSortedIncidents.length === 0) {
      e.preventDefault();
      alert('No incident records available to export for the selected filters.');
    }
  };

  // ── 6. Clinical Badge Style Resolvers ───────────────────────────────────────
  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Medium
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Open
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Accepted
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Investigating
          </span>
        );
      case 'PENDING_ACTION':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pending Action
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            Under Review
          </span>
        );
      case 'CLOSED':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Closed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // ── 7. Loading and Error Fallback Views ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-[#1E2B58]" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading Department Incident Register...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-rose-800 text-sm">Failed to load incident register</h3>
          <p className="text-rose-600 text-xs mt-1">
            {error instanceof Error ? error.message : 'Unable to synchronize departmental records.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* ── TOP HEADER: Department Records Title & Export Button ──────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-extrabold uppercase tracking-widest text-blue-600">
            Department Records
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Incident Register
          </h1>
          <p className="text-sm text-slate-500">
            Search, filter and review incidents reported to your department.
          </p>
        </div>

        <a
          href={csvExport.href}
          download={csvExport.filename}
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#1E2B58] hover:bg-[#162044] transition-colors shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {/* ── FILTER CARD: Multi-Parameter Workbench ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Find incidents</h2>
          <p className="text-xs text-slate-500">
            Use one or more filters to narrow the register.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          {/* Search Input */}
          <div className="lg:col-span-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="ID, title, location or reporter"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all text-slate-800 placeholder-slate-400 bg-white"
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-700 bg-white cursor-pointer"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="PENDING_ACTION">Pending Action</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-700 bg-white cursor-pointer"
            >
              <option value="ALL">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-700 bg-white cursor-pointer"
            >
              <option value="ALL">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Sort
            </label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-700 bg-white cursor-pointer"
            >
              <option value="NEWEST">Newest reported</option>
              <option value="OLDEST">Oldest reported</option>
              <option value="SEVERITY_DESC">Highest severity</option>
              <option value="SEVERITY_ASC">Lowest severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── RESULTS CARD: Department Incidents Table Ledger ───────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Table Title Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Department incidents</h2>
            <p className="text-xs text-slate-500 font-medium">
              {totalRecords} records found
            </p>
          </div>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70 border-b border-slate-200">
                <th className="py-3.5 px-6">Incident</th>
                <th className="py-3.5 px-6">Severity</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6">Reporter</th>
                <th className="py-3.5 px-6">Reported</th>
                <th className="py-3.5 px-4 text-right"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-6 text-center text-xs text-slate-400">
                    No departmental incidents matched your search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map((incident: Incident) => (
                  <tr
                    key={incident.id}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Incident ID and Title */}
                    <td className="py-3.5 px-6">
                      <span className="text-xs font-mono font-bold text-blue-600 block mb-0.5">
                        #{incident.id}
                      </span>
                      <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {incident.title}
                      </span>
                    </td>

                    {/* Severity Pill */}
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      {getSeverityBadge(incident.severity)}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      {getStatusBadge(incident.status)}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-6 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {incident.category || 'General'}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-6 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {incident.location || 'Unspecified'}
                    </td>

                    {/* Reporter Name */}
                    <td className="py-3.5 px-6 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {incident.reporter?.name || 'Unknown Reporter'}
                    </td>

                    {/* Reported Date */}
                    <td className="py-3.5 px-6 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {new Date(incident.createdAt).toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Chevron Indicator */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS: 10 Records Per Page ──────────────────────── */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
          <p className="text-xs font-medium text-slate-500">
            Showing{' '}
            <strong className="text-slate-800">
              {totalRecords === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, totalRecords)}
            </strong>{' '}
            of <strong className="text-slate-800">{totalRecords}</strong>
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              &lt; Previous
            </button>

            <span className="text-xs font-semibold text-slate-600">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#1E2B58] hover:bg-[#162044] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
            >
              Next &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};