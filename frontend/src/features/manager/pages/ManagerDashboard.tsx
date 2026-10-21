// frontend/src/features/manager/pages/ManagerDashboard.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { managerApi } from '../api/manager.api';
import type { ManagerDashboardData } from '../api/manager.api';
import toast from 'react-hot-toast';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Download,
  UserX,
} from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();

  // State to hold live dashboard data
  const [dashboardData, setDashboardData] = useState<ManagerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch command centre data from the backend
  const fetchDashboardMetrics = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const data = await managerApi.getDashboardData();
      setDashboardData(data);
      if (isManualRefresh) {
        toast.success('Command Centre metrics synchronized.');
      }
    } catch (err: any) {
      console.error('Failed to load manager command centre:', err);
      toast.error('Unable to synchronize live clinical risk data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  // Format date helper for human-readable presentation
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Synchronizing Clinical Command Centre...
        </p>
      </div>
    );
  }

  // Safe fallback if data is empty or still loading
  const kpis = dashboardData?.kpis ?? {
    awaitingDecisionCount: 0,
    unassignedCount: 0,
    findingsToApproveCount: 0,
    awaitingVerificationCount: 0,
    overdueActionsCount: 0,
    highRiskOpenCount: 0,
  };

  const health = dashboardData?.departmentHealth ?? {
    closureRatePercentage: 0,
    actionCompletionPercentage: 0,
    slaCompliancePercentage: 0,
    openIncidentsCount: 0,
    oldestOpenIncidentDays: 0,
  };

  const attentionItems = dashboardData?.attentionItems ?? [];
  const overdueActions = dashboardData?.overdueActions ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* ── TOP BANNER: Command Centre Identity ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest uppercase bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-200">
              Department Command Centre
            </span>
            <span className="text-xs text-slate-400 font-medium">• Live Operational Governance</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Manager Dashboard</h1>
          <p className="text-xs text-slate-500">
            Welcome back, <strong className="text-slate-800">Dr. Manager</strong>. Priorities requiring your decision are highlighted below.
          </p>
        </div>

        {/* Command Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchDashboardMetrics(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            Refresh
          </button>
          <button
            onClick={() => toast.success('Exporting clinical safety report...')}
            className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export
          </button>
          <button
            onClick={() => navigate('/incidents')}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            Review Queue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── TIER 1: 6 ACTIONABLE KPI METRIC CARDS ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Awaiting My Decision */}
        <div
          onClick={() => navigate('/incidents')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Awaiting My Decision
            </span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-600">{kpis.awaitingDecisionCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">New reports need triage</p>
          </div>
        </div>

        {/* 2. Unassigned */}
        <div
          onClick={() => navigate('/incidents')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-purple-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Unassigned
            </span>
            <UserX className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-600">{kpis.unassignedCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Accepted, no investigator</p>
          </div>
        </div>

        {/* 3. Findings to Approve */}
        <div
          onClick={() => navigate('/incidents')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-amber-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Findings to Approve
            </span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-600">{kpis.findingsToApproveCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">RCA review required</p>
          </div>
        </div>

        {/* 4. Awaiting Verification */}
        <div
          onClick={() => navigate('/incidents')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-emerald-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Awaiting Verification
            </span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600">{kpis.awaitingVerificationCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Completed CAPAs to verify</p>
          </div>
        </div>

        {/* 5. Overdue Actions */}
        <div
          onClick={() => {
            const el = document.getElementById('overdue-workbench');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-rose-400 cursor-pointer transition-all flex flex-col justify-between bg-rose-50/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
              Overdue Actions
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600">{kpis.overdueActionsCount}</span>
            <p className="text-[11px] text-rose-600 mt-0.5 font-medium">Past due and incomplete</p>
          </div>
        </div>

        {/* 6. High-Risk Open */}
        <div
          onClick={() => navigate('/incidents')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-orange-400 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              High-Risk Open
            </span>
            <ShieldAlert className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-orange-600">{kpis.highRiskOpenCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">High or critical exposure</p>
          </div>
        </div>
      </div>

      {/* ── TIER 2: OPERATIONAL SPLIT GRID ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (65% width): Needs Your Attention Queue */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Needs Your Attention</h2>
              <p className="text-[11px] text-slate-500">
                Prioritized queue sorted strictly by clinical risk severity and target deadlines
              </p>
            </div>
            <button
              onClick={() => navigate('/incidents')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {attentionItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              All clinical triage items, findings reviews, and actions are up to date.
            </div>
          ) : (
            <div className="space-y-2.5">
              {attentionItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-slate-100 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {item.daysOverdue !== undefined && item.daysOverdue > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                          Overdue
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : item.severity === 'HIGH'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        #{item.id} {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {item.assigneeName ? `Owner: ${item.assigneeName}` : 'Reporter: Clinical Staff'}
                      {item.daysOverdue !== undefined && item.daysOverdue > 0
                        ? ` • ${item.daysOverdue} days overdue`
                        : ''}
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(`/incidents/${item.incidentId}`)}
                    className="self-start sm:self-center px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm whitespace-nowrap"
                  >
                    Review now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (35% width): Department Health & Compliance */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Department Health</h2>
            <p className="text-[11px] text-slate-500">Current workflow operational benchmarks</p>
          </div>

          {/* Health Benchmark 1: Closure Rate */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Closure rate</span>
              <span className="font-bold text-slate-900">{health.closureRatePercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(health.closureRatePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Health Benchmark 2: Action Completion */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Action completion</span>
              <span className="font-bold text-slate-900">{health.actionCompletionPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(health.actionCompletionPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Health Benchmark 3: Clinical SLA Compliance */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">SLA compliance</span>
              <span className="font-bold text-slate-900">{health.slaCompliancePercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(health.slaCompliancePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Ageing & Backlog Counters */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
              <p className="text-xl font-black text-slate-900">{health.openIncidentsCount}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">Open incidents</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
              <p className="text-xl font-black text-amber-600">{health.oldestOpenIncidentDays}d</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">Oldest open</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIER 3: OVERDUE ACTIONS WORKBENCH ──────────────────────────────── */}
      <div id="overdue-workbench" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Overdue Actions Register</h2>
            <p className="text-[11px] text-slate-500">
              Most overdue and highest-priority corrective & preventive actions requiring leadership intervention
            </p>
          </div>
          <button
            onClick={() => navigate('/incidents')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {overdueActions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
            No overdue actions. All corrective tasks are on track within their deadlines.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overdueActions.map((action) => (
              <div
                key={action.actionId}
                className="border border-rose-200 bg-rose-50/20 rounded-xl p-4 shadow-sm hover:border-rose-300 transition-all space-y-3"
              >
                {/* Badges strip */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                    {action.daysOverdue} Days Overdue
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      action.severity === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {action.severity}
                  </span>
                </div>

                {/* Title & Incident Link */}
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900">{action.actionTitle}</h3>
                  <p className="text-[11px] text-slate-600 truncate">
                    Incident #{action.incidentId}: {action.incidentTitle}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Owner: <span className="font-semibold text-slate-700">{action.assignedOwnerName}</span> • Due: {formatDate(action.dueDate)}
                  </p>
                </div>

                {/* Direct Action Control Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-rose-100">
                  <button
                    onClick={() => navigate(`/incidents/${action.incidentId}`)}
                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    View
                  </button>
                  <button
                    onClick={() => navigate('/team')}
                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => toast.error(`Action #${action.actionId} escalated to Clinical Safety Board.`)}
                    className="px-2.5 py-1 text-xs font-bold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow-sm"
                  >
                    Escalate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;