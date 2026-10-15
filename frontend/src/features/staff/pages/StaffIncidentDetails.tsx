// frontend/src/features/staff/pages/StaffIncidentDetails.tsx

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIncidentById } from '../../incidents/hooks/useIncidents';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building,
  Tag,
  ShieldAlert,
  User,
  Paperclip,
  AlertCircle,
  FileText,
  Search,
} from 'lucide-react';

// ── Enterprise Clinical Color Tokens ─────────────────────────────────────────
const NAVY = '#1E2B5E';
const ROYAL = '#2952C4';
const BG_PAGE = '#F8FAFC';
const BORDER = '#D8DCE8';
const TEXT = '#1A2447';
const MUTED = '#6B7494';

// Status badge styles
const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  OPEN: { bg: '#EBF0FA', color: '#2952C4', border: '#C0CBE0' },
  ACCEPTED: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  REJECTED: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  INVESTIGATING: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  PENDING_ACTION: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  IN_PROGRESS: { bg: '#FDF4FF', color: '#9333EA', border: '#F3E8FF' },
  UNDER_REVIEW: { bg: '#EBF0FA', color: '#0EA5E9', border: '#BAE6FD' },
  CLOSED: { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
};

/**
 * Staff Incident Details View
 *
 * Dedicated Read-Only Clinical Tracking View for Hospital Staff:
 * - Real-time Status Badge & Progress Timeline
 * - Rejection Rationale Notice (if rejected by Manager)
 * - Incident Clinical Chronology & Description
 * - Severity, Category, Department & Location metadata
 * - Assigned Clinical Team (Investigator & Action Owner)
 * - Root Cause Analysis (RCA) findings once published
 * - Attached evidence documents
 */
export const StaffIncidentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const incidentId = Number(id);

  const { data: incident, isLoading, isError } = useIncidentById(incidentId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-72">
        <div
          className="animate-spin rounded-full h-10 w-10 border-[3px] border-t-transparent"
          style={{ borderColor: `${ROYAL} transparent ${ROYAL} ${ROYAL}` }}
        />
      </div>
    );
  }

  if (isError || !incident) {
    return (
      <div className="mx-auto max-w-2xl mt-12 p-8 text-center rounded-2xl bg-white border border-[#D8DCE8] shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1A2447] mb-2">
          Incident Record Not Found
        </h2>
        <p className="text-sm text-[#6B7494] mb-6">
          The requested clinical safety incident could not be found or you do not have permission to view it.
        </p>
        <button
          type="button"
          onClick={() => navigate('/my-incidents')}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition"
          style={{ backgroundColor: ROYAL }}
        >
          &larr; Return to My Incidents
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[incident.status] ?? {
    bg: '#F1F5F9',
    color: MUTED,
    border: '#CBD5E1',
  };

  const year = new Date(incident.createdAt).getFullYear();
  const referenceId = `INC-${year}-${String(incident.id).padStart(4, '0')}`;

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: BG_PAGE, color: TEXT }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/my-incidents')}
            className="flex items-center gap-2 text-sm font-semibold hover:underline cursor-pointer"
            style={{ color: ROYAL }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Incidents
          </button>
          <span className="font-mono text-xs font-bold text-[#6B7494]">
            {referenceId}
          </span>
        </div>

        {/* Rejection Alert Banner (if incident was rejected) */}
        {incident.status === 'REJECTED' && incident.rejectionReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-900">Incident Returned / Rejected by Department Manager</h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  Reason provided: {incident.rejectionReason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header Summary Card */}
        <div
          className="rounded-2xl p-6 bg-white shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D8DCE8]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Incident #{incident.id}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-[#6B7494] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(incident.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
                {incident.title}
              </h1>
            </div>

            <div>
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold tracking-wide"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  border: `1px solid ${statusStyle.border}`,
                }}
              >
                {incident.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Clinical Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/60">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7494] mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Severity
              </span>
              <p className="text-sm font-bold text-[#1A2447]">{incident.severity}</p>
            </div>

            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/60">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7494] mb-1">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                Category
              </span>
              <p className="text-sm font-bold text-[#1A2447] truncate" title={incident.category}>
                {incident.category}
              </p>
            </div>

            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/60">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7494] mb-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Location
              </span>
              <p className="text-sm font-bold text-[#1A2447] truncate" title={incident.location}>
                {incident.location || 'Hospital Ward'}
              </p>
            </div>

            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/60">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7494] mb-1">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                Department
              </span>
              <p className="text-sm font-bold text-[#1A2447] truncate" title={incident.department?.name}>
                {incident.department?.name || 'Department'}
              </p>
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <div
          className="rounded-2xl p-6 bg-white shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
            <FileText className="w-4 h-4 text-[#2952C4]" />
            Clinical Chronology & Description
          </h3>
          <div className="rounded-xl p-4 bg-slate-50/70 border border-slate-200/70">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {incident.description}
            </p>
          </div>
        </div>

        {/* Clinical Governance & Assigned Team */}
        <div
          className="rounded-2xl p-6 bg-white shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: NAVY }}>
            <User className="w-4 h-4 text-[#2952C4]" />
            Clinical Team & Responsibilities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2952C4] block mb-1">
                Reporting Staff
              </span>
              <p className="text-sm font-bold text-[#1A2447]">
                {incident.reporter?.name || 'Logged Staff Member'}
              </p>
              <p className="text-xs text-[#6B7494] mt-0.5">Author of submission</p>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
                Lead Investigator
              </span>
              <p className="text-sm font-bold text-[#1A2447]">
                {incident.investigator?.name || 'Pending Manager Assignment'}
              </p>
              <p className="text-xs text-[#6B7494] mt-0.5">
                {incident.investigator ? 'Conducting RCA' : 'Not yet assigned'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block mb-1">
                CAPA Action Owner
              </span>
              <p className="text-sm font-bold text-[#1A2447]">
                {incident.actionOwner?.name || 'Pending Investigation'}
              </p>
              <p className="text-xs text-[#6B7494] mt-0.5">
                {incident.actionOwner ? 'Remediation Owner' : 'Not yet assigned'}
              </p>
            </div>
          </div>
        </div>

        {/* RCA Findings Section (Rendered if root cause is identified) */}
        {incident.rootCause && (
          <div
            className="rounded-2xl p-6 bg-white shadow-sm"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
              <Search className="w-4 h-4 text-purple-600" />
              Root Cause Analysis (RCA) Outcome
            </h3>
            <div className="rounded-xl p-4 bg-purple-50/40 border border-purple-200/60 space-y-2">
              {incident.rootCauseCategory && (
                <p className="text-xs text-[#6B7494]">
                  <strong className="text-slate-800">Primary Category:</strong> {incident.rootCauseCategory}
                </p>
              )}
              <p className="text-sm leading-relaxed text-slate-800 font-medium">
                {incident.rootCause}
              </p>
            </div>
          </div>
        )}

        {/* Attachments Section */}
        <div
          className="rounded-2xl p-6 bg-white shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
            <Paperclip className="w-4 h-4 text-[#2952C4]" />
            Uploaded Attachments & Clinical Records
          </h3>
          {incident.attachments && incident.attachments.length > 0 ? (
            <ul className="divide-y divide-[#D8DCE8] border border-[#D8DCE8] rounded-xl overflow-hidden">
              {incident.attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition text-sm"
                >
                  <span className="font-medium text-[#1A2447] flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    {file.fileName}
                  </span>
                  <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                    {file.fileType || 'File'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#6B7494] italic p-3 rounded-lg bg-slate-50 border border-slate-200/50">
              No evidence files or photos were attached with this incident report.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffIncidentDetails;
