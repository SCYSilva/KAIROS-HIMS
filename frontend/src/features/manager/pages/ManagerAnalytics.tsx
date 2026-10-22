// frontend/src/features/manager/pages/ManagerAnalytics.tsx

import React, { Component, type ErrorInfo, type ReactNode, useState, useEffect } from 'react';
import { managerApi } from '../api/manager.api';
import type { ManagerAnalyticsData } from '../api/manager.api';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  FolderKanban,
  ShieldCheck,
} from 'lucide-react';

// ── In-Component Error Boundary ───────────────────────────────────────────
// Catches unexpected rendering exceptions safely to avoid dashboard disruption
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AnalyticsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Analytics Telemetry Interrupted:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center max-w-xl mx-auto my-12">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-rose-900">Analytics Telemetry Interrupted</h3>
          <p className="text-xs text-rose-700 mt-1 mb-4">
            An unexpected error occurred while loading metrics. You can retry refreshing the feed.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700"
          >
            Retry Analytics Feed
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main Clinical Analytics View (Focused 5-Metric KPI Board) ──────────────
export const ManagerAnalytics: React.FC = () => {
  const [data, setData] = useState<ManagerAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Loads real-time departmental risk telemetry from the backend API
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const res = await managerApi.getAnalytics();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load manager analytics telemetry:', err);
      setIsError(true);
      setErrorMessage(
        err.response?.data?.message || 'Unable to retrieve department analytics at this time.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Loading State with Spinner
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-10 h-10 border-4 border-[#1E2B58] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Aggregating Departmental Risk Telemetry...
        </p>
      </div>
    );
  }

  // Error State Display
  if (isError || !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
        <AlertOctagon className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Analytics Telemetry Unavailable</h3>
        <p className="text-xs text-slate-600 mt-1 mb-5">{errorMessage}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162144] inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reconnect Telemetry Engine
        </button>
      </div>
    );
  }

  // Safe fallback values from summary API contract
  const summary = data.summary ?? {
    totalIncidents: 0,
    openTriage: 0,
    criticalSeverity: 0,
    closedResolved: 0,
    avgResolutionDays: 0,
  };

  const total = summary.totalIncidents || 0;
  const closed = summary.closedResolved || 0;
  const openTriage = summary.openTriage || 0;
  const critical = summary.criticalSeverity || 0;

  return (
    <AnalyticsErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* ── Top Header Banner ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Risk & Performance Analytics
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2B58]/10 text-[#1E2B58] border border-[#1E2B58]/20">
                <ShieldCheck className="w-3 h-3 text-[#1E2B58]" /> LIVE TELEMETRY
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time clinical incident distribution, resolution velocity, and safety governance benchmarks.
            </p>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs flex items-center gap-1.5 self-start transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Metrics
          </button>
        </div>

        {/* ── Core Clinical Risk KPI Metric Cards (Exclusively 5 Metrics) ──── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* 1. Total Reports */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Reports</span>
              <div className="w-7 h-7 rounded-lg bg-[#1E2B58]/10 text-[#1E2B58] flex items-center justify-center font-bold">
                <FolderKanban className="w-4 h-4 text-[#1E2B58]" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{total}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Logged across department</p>
            </div>
          </div>

          {/* 2. Open Triage */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Triage</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-blue-600 tracking-tight">{openTriage}</p>
                {openTriage > 0 ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Pending
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Clear ✓
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Awaiting manager acceptance</p>
            </div>
          </div>

          {/* 3. Critical Risk */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Critical Risk</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-rose-600 tracking-tight">{critical}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Sentinel / Severe impact</p>
            </div>
          </div>

          {/* 4. Closed Cases */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Closed Cases</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600 tracking-tight">{closed}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">3-Gate validated closure</p>
            </div>
          </div>

          {/* 5. Resolution Velocity */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolution Velocity</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-purple-600 tracking-tight">
                {summary.avgResolutionDays ?? 0}{' '}
                <span className="text-xs font-medium text-slate-500">days</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Average incident lifecycle</p>
            </div>
          </div>

        </div>

      </div>
    </AnalyticsErrorBoundary>
  );
};

export default ManagerAnalytics;
