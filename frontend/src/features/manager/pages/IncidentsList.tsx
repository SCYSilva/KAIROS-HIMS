// frontend/src/pages/IncidentsList.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDepartmentIncidents } from '../../incidents/hooks/useIncidents';
import { useAuthContext } from '../../auth/context/AuthContext';
import { getDepartmentName } from '../../../shared/utils/constants';
import type { Incident } from '../../incidents/types/incident';

export const IncidentsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const departmentId = user?.departmentId ?? 1;

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Fetch incidents for this department
  const { data: incidents, isLoading, isError, error } = useDepartmentIncidents(departmentId);

  // Filter logic
  const filteredIncidents = (incidents || []).filter((incident: Incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.id.toString().includes(searchTerm) ||
      Boolean(incident.reporter?.name?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || incident.status === statusFilter;
    const matchesSeverity = severityFilter === 'ALL' || incident.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // CSV Export Logic
  const generateCSVData = () => {
    if (!filteredIncidents || filteredIncidents.length === 0) return '';
    const headers = ['ID', 'Title', 'Severity', 'Status', 'Category', 'Location', 'Reporter', 'Created At'];
    const rows = filteredIncidents.map((i: Incident) => [
      i.id,
      `"${i.title.replaceAll('"', '""')}"`,
      i.severity,
      i.status,
      i.category,
      `"${i.location.replaceAll('"', '""')}"`,
      `"${(i.reporter?.name || 'Unknown').replaceAll('"', '""')}"`,
      new Date(i.createdAt).toISOString(),
    ]);
    return [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');
  };

  const getCSVExportData = () => {
    const csvContent = generateCSVData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    return {
      href: url,
      filename: `incidents-dept-${departmentId}-${new Date().toISOString().split('T')[0]}.csv`,
    };
  };

  const csvExport = getCSVExportData();

  const handleExportCSV = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!filteredIncidents || filteredIncidents.length === 0) {
      e.preventDefault();
      alert('No data available to export.');
    }
  };

  // Helper function to get badge colors for Status
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      OPEN: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
      ACCEPTED: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
      INVESTIGATING: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
      PENDING_ACTION: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
      UNDER_REVIEW: { bg: '#EFF6FF', color: '#0EA5E9', border: '#BAE6FD' },
      CLOSED: { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
      REJECTED: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
    };
    const s = styles[status] || { bg: '#F1F5F9', color: '#6B7494', border: '#CBD5E1' };
    return (
      <span
        className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide inline-block"
        style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Helper function to get badge colors for Severity
  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      CRITICAL: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
      HIGH: { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
      MEDIUM: { bg: '#FEFCE8', color: '#CA8A04', border: '#FEF08A' },
      LOW: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
    };
    const s = styles[severity] || { bg: '#F1F5F9', color: '#6B7494', border: '#CBD5E1' };
    return (
      <span
        className="px-2.5 py-1 rounded-md text-xs font-bold uppercase inline-block"
        style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {severity}
      </span>
    );
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-80">
        <div
          className="animate-spin rounded-full h-12 w-12 border-[3px] border-t-transparent"
          style={{ borderColor: '#2952C4 transparent #2952C4 #2952C4' }}
        />
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="p-6 rounded-2xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <h3 className="font-bold text-red-600 text-lg">Error loading incidents</h3>
        <p className="text-red-500 text-base mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: '#1A2447' }}
          >
            Incident Reports
          </h1>
          <p className="text-base mt-1" style={{ color: '#6B7494' }}>
            Showing <strong>{filteredIncidents.length}</strong> total logged incidents for {getDepartmentName(departmentId)}
          </p>
        </div>

        {/* Export Button */}
        <a
          href={csvExport.href}
          download={csvExport.filename}
          onClick={handleExportCSV}
          className="px-5 py-3 text-sm font-bold rounded-xl flex items-center gap-2.5 transition-all shadow-sm cursor-pointer shrink-0"
          style={{
            backgroundColor: '#1E2B5E',
            color: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(30,43,94,0.20)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#16204A'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1E2B5E'; }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export CSV Report
        </a>
      </div>

      {/* Filters & Search Bar */}
      <div
        className="p-5 rounded-2xl flex flex-col md:flex-row gap-4"
        style={{ backgroundColor: '#F7F8FA', border: '1.5px solid #D8DCE8', boxShadow: '0 2px 8px rgba(30,43,94,0.06)' }}
      >
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#9BA4BC' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search incidents by ID, title, or reporter name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 text-[15px] rounded-xl outline-none transition-all"
            style={{
              backgroundColor: '#F1F3F8',
              border: '1.5px solid #D8DCE8',
              color: '#1A2447',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#2952C4'; e.currentTarget.style.boxShadow = '0 0 0 3px #EBF0FA'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D8DCE8'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 text-[15px] font-semibold rounded-xl cursor-pointer min-w-[180px] outline-none"
          style={{ backgroundColor: '#F1F3F8', border: '1.5px solid #D8DCE8', color: '#3B4565' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="PENDING_ACTION">Pending Action</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="CLOSED">Closed</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-3 text-[15px] font-semibold rounded-xl cursor-pointer min-w-[180px] outline-none"
          style={{ backgroundColor: '#F1F3F8', border: '1.5px solid #D8DCE8', color: '#3B4565' }}
        >
          <option value="ALL">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Data Table */}
      <div
        className="rounded-2xl overflow-hidden shadow-xs"
        style={{ backgroundColor: '#F7F8FA', border: '1.5px solid #D8DCE8', boxShadow: '0 2px 8px rgba(30,43,94,0.06)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Table Header */}
            <thead>
              <tr
                className="text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: '#EDEEF3', borderBottom: '1.5px solid #D8DCE8', color: '#6B7494' }}
              >
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Incident Title</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Reporter</th>
                <th className="px-6 py-4 text-right">Reported Date</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody style={{ borderTop: '1px solid #D8DCE8' }}>
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-base font-medium" style={{ color: '#9BA4BC' }}>
                    No incidents found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident: Incident, i: number) => (
                  <tr
                    key={incident.id}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                    className="cursor-pointer group transition-colors"
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F1F3F8',
                      borderBottom: '1px solid #EBF0FA',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EBF0FA'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? '#FFFFFF' : '#F1F3F8'; }}
                  >
                    <td className="px-6 py-4 text-[15px] font-mono font-bold" style={{ color: '#6B7494' }}>#{incident.id}</td>

                    <td className="px-6 py-4">
                      <div
                        className="text-[15px] font-bold transition-colors group-hover:text-blue-700"
                        style={{ color: '#1A2447' }}
                      >
                        {incident.title}
                      </div>
                    </td>

                    <td className="px-6 py-4">{getSeverityBadge(incident.severity)}</td>
                    <td className="px-6 py-4">{getStatusBadge(incident.status)}</td>
                    <td className="px-6 py-4 text-[14px] font-medium" style={{ color: '#3B4565' }}>{incident.category}</td>
                    <td className="px-6 py-4 text-[14px] font-medium" style={{ color: '#3B4565' }}>
                      {getDepartmentName(incident.departmentId)}
                    </td>
                    <td className="px-6 py-4 text-[14px] font-medium" style={{ color: '#3B4565' }}>
                      {incident.reporter?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-[14px] font-medium text-right whitespace-nowrap" style={{ color: '#6B7494' }}>
                      {new Date(incident.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
