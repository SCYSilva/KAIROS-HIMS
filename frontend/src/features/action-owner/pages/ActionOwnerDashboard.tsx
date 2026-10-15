import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FilterX,
  RefreshCw,
  Search,
} from 'lucide-react';
import { actionOwnerApi, type ActionItem } from '../api/actionOwner.api';

// Enterprise Clinical Design Tokens
const NAVY = '#1E2B5E';
const BORDER = '#D8DCE8';

const inputClass =
  'h-11 w-full rounded-lg border border-[#D8DCE8] bg-white px-3 text-sm text-[#1A2447] outline-none transition focus:border-[#2952C4] focus:ring-2 focus:ring-blue-100';

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (isoString: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoString));

const dueLabel = (item: ActionItem) => {
  if (item.status === 'COMPLETED') {
    return item.reviewStatus === 'VERIFIED' ? 'Verified' : 'Submitted for verification';
  }
  if (item.dueInDays < 0) {
    return `${Math.abs(item.dueInDays)} day${Math.abs(item.dueInDays) === 1 ? '' : 's'} overdue`;
  }
  if (item.dueInDays === 0) return 'Due today';
  return `${item.dueInDays} day${item.dueInDays === 1 ? '' : 's'} remaining`;
};

const statusStyle = (item: ActionItem) => {
  if (item.reviewStatus === 'RETURNED_FOR_REVISION') {
    return 'border-amber-300 bg-amber-50 text-amber-900';
  }
  if (item.reviewStatus === 'COMPLETED_PENDING_VERIFICATION') {
    return 'border-sky-300 bg-sky-50 text-sky-900';
  }
  if (item.reviewStatus === 'VERIFIED') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-900';
  }
  if (item.status === 'IN_PROGRESS') {
    return 'border-blue-300 bg-blue-50 text-blue-900';
  }
  return 'border-slate-300 bg-slate-50 text-slate-800';
};

const statusLabel = (item: ActionItem) => {
  if (item.reviewStatus === 'RETURNED_FOR_REVISION') return 'Revision required';
  if (item.reviewStatus === 'COMPLETED_PENDING_VERIFICATION') return 'Awaiting verification';
  if (item.reviewStatus === 'VERIFIED') return 'Verified';
  return item.status === 'OPEN' ? 'Not started' : titleCase(item.status);
};

export const ActionOwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [due, setDue] = useState('ALL');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    if (status) p.status = status;
    if (priority) p.priority = priority;
    if (due && due !== 'ALL') p.due = due;
    return p;
  }, [search, status, priority, due]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['action-owner-dashboard', params],
    queryFn: () => actionOwnerApi.dashboard(params),
  });

  const readNotificationMutation = useMutation({
    mutationFn: ({ notificationId }: { notificationId: number; actionId: number }) =>
      actionOwnerApi.readNotification(notificationId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['action-owner-dashboard'] });
      navigate(`/action-owner/${variables.actionId}`);
    },
  });

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setDue('ALL');
  };

  const hasFilters = Boolean(search || status || priority || due !== 'ALL');
  const summary = data?.summary;
  const unreadNotifications = data?.notifications.filter((n) => !n.readAt) ?? [];
  const urgentNotifications = unreadNotifications.filter((n) =>
    ['OVERDUE', 'RETURNED'].includes(n.type)
  );

  const kpiCards = [
    {
      id: 'open',
      label: 'Not started',
      value: summary?.open ?? 0,
      description: 'Pending task initiation',
      icon: CircleDashed,
      tone: 'bg-slate-100 text-slate-700',
      active: status === 'OPEN',
      action: () => {
        setStatus(status === 'OPEN' ? '' : 'OPEN');
        setDue('ALL');
      },
    },
    {
      id: 'inProgress',
      label: 'In progress',
      value: summary?.inProgress ?? 0,
      description: 'Active remediation work',
      icon: Clock3,
      tone: 'bg-blue-50 text-blue-700',
      active: status === 'IN_PROGRESS',
      action: () => {
        setStatus(status === 'IN_PROGRESS' ? '' : 'IN_PROGRESS');
        setDue('ALL');
      },
    },
    {
      id: 'overdue',
      label: 'Overdue',
      value: summary?.overdue ?? 0,
      description: 'Breached SLA timeline',
      icon: CalendarClock,
      tone: (summary?.overdue ?? 0) > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600',
      active: due === 'OVERDUE',
      action: () => {
        setDue(due === 'OVERDUE' ? 'ALL' : 'OVERDUE');
        setStatus('');
      },
    },
    {
      id: 'revisions',
      label: 'Revision required',
      value: summary?.revisions ?? 0,
      description: 'Returned by manager',
      icon: AlertCircle,
      tone: (summary?.revisions ?? 0) > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600',
      active: false,
      action: () => {
        setStatus('IN_PROGRESS');
      },
    },
    {
      id: 'pendingVerification',
      label: 'Awaiting verification',
      value: summary?.pendingVerification ?? 0,
      description: 'Submitted to manager gate',
      icon: FileCheck2,
      tone: 'bg-sky-50 text-sky-700',
      active: status === 'COMPLETED',
      action: () => {
        setStatus(status === 'COMPLETED' ? '' : 'COMPLETED');
      },
    },
    {
      id: 'verified',
      label: 'Verified',
      value: summary?.verified ?? 0,
      description: 'Validated effective & closed',
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-800',
      active: false,
      action: () => {
        setStatus('COMPLETED');
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12 text-[#1A2447]">
      {/* ── Page Header: Deep Navy Healthcare Card ────────────────────── */}
      <header
        className="rounded-2xl p-6 text-white shadow-sm md:p-8"
        style={{
          backgroundColor: NAVY,
          border: '1px solid #141F45',
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                Hospital Clinical Governance
              </span>
              <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-100">
                Action Owner Role
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
              My Assigned Actions
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-blue-100">
              Execute assigned corrective & preventive clinical actions, submit documented evidence,
              and maintain closed-loop audit compliance.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 backdrop-blur-sm">
            <ClipboardCheck className="h-8 w-8 text-blue-200" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-blue-200">Total Assigned Queue</p>
              <p className="text-2xl font-extrabold leading-none text-white">
                {summary?.total ?? 0}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Top 6 KPI Metric Cards (Clickable Filters) ───────────────────── */}
      <section aria-label="Clinical KPI Metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.action}
              className={`rounded-xl bg-white p-4 text-left transition-all cursor-pointer ${
                card.active
                  ? 'border-2 border-[#2952C4] shadow-md ring-2 ring-blue-100'
                  : 'border border-[#D8DCE8] shadow-sm hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#6B7494]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#1A2447]">{card.value}</p>
                </div>
                <span className={`rounded-lg p-2 ${card.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#6B7494]">{card.description}</p>
            </button>
          );
        })}
      </section>

      {/* ── Urgent Attention Alerts Banner ─────────────────────────────── */}
      {unreadNotifications.length > 0 && (
        <section
          className="rounded-xl bg-white shadow-sm"
          style={{ border: `1.5px solid ${urgentNotifications.length > 0 ? '#FCD34D' : BORDER}` }}
        >
          <div className="flex items-center justify-between border-b border-[#D8DCE8] px-5 py-3.5 bg-amber-50/50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1A2447]">
                  Urgent Attention Notifications ({unreadNotifications.length})
                </h2>
                <p className="text-xs text-[#6B7494]">
                  Overdue tasks or actions returned by the Department Manager require priority action.
                </p>
              </div>
            </div>
            {urgentNotifications.length > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {urgentNotifications.length} Critical
              </span>
            )}
          </div>

          <div className="grid divide-y divide-[#D8DCE8] md:grid-cols-2 md:divide-x md:divide-y-0">
            {unreadNotifications.slice(0, 4).map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() =>
                  readNotificationMutation.mutate({
                    notificationId: notification.id,
                    actionId: notification.actionItemId,
                  })
                }
                className="flex items-start gap-3 p-4 text-left transition hover:bg-slate-50 cursor-pointer"
              >
                <span
                  className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
                    notification.type === 'OVERDUE'
                      ? 'bg-red-100 text-red-700'
                      : notification.type === 'RETURNED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1A2447]">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-[#6B7494] line-clamp-2 leading-relaxed">
                    {notification.message}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 mt-1" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Filter Toolbar ─────────────────────────────────────────────── */}
      <section
        className="rounded-xl bg-white p-4 shadow-sm"
        style={{ border: `1px solid ${BORDER}` }}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          {/* Search text */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action title, incident, or description..."
              className={`${inputClass} pl-10`}
            />
          </div>

          {/* Status select */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
            aria-label="Filter by status"
          >
            <option value="">All progress states</option>
            <option value="OPEN">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {/* Priority select */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Due date filter */}
          <select
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={inputClass}
            aria-label="Filter by due date"
          >
            <option value="ALL">All due dates</option>
            <option value="DUE_SOON">Due within 3 days</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          {/* Refresh / Clear Button */}
          <button
            type="button"
            onClick={hasFilters ? clearFilters : () => refetch()}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D8DCE8] px-4 text-sm font-semibold text-[#1A2447] transition hover:bg-slate-50 cursor-pointer"
          >
            {hasFilters ? (
              <>
                <FilterX className="h-4 w-4 text-[#6B7494]" />
                <span>Reset</span>
              </>
            ) : (
              <>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ── Assigned Action Queue ───────────────────────────────────────── */}
      <section
        className="overflow-hidden rounded-xl bg-white shadow-sm"
        style={{ border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-between border-b border-[#D8DCE8] px-5 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-[#1A2447]">Assigned Action Queue</h2>
            <p className="text-xs text-[#6B7494]">
              Ranked by closest deadline first, then clinical priority.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#6B7494]">
            {data?.items.length ?? 0} {data?.items.length === 1 ? 'action' : 'actions'} listed
          </span>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="divide-y divide-[#D8DCE8] p-5 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="animate-pulse space-y-2 py-4">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/3 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          /* Error State */
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <h3 className="mt-3 text-base font-bold text-[#1A2447]">Unable to load actions</h3>
            <p className="mt-1 text-sm text-[#6B7494]">
              Could not communicate with the clinical backend service.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-lg bg-[#1E2B5E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#152048]"
            >
              Retry
            </button>
          </div>
        ) : !data?.items.length ? (
          /* Empty State */
          <div className="p-16 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-[#1A2447]">No actions found</h3>
            <p className="mt-1 text-sm text-[#6B7494]">
              {hasFilters
                ? 'No actions matched your active filter criteria.'
                : 'You have zero pending corrective actions assigned at this time.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-[#D8DCE8] px-4 py-2 text-xs font-semibold text-[#2952C4] hover:bg-slate-50 cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          /* Action Item Queue Cards */
          <div className="divide-y divide-[#D8DCE8]">
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/action-owner/${item.id}`)}
                className="group flex flex-col gap-4 p-5 transition hover:bg-slate-50/80 cursor-pointer lg:flex-row lg:items-center lg:justify-between"
              >
                {/* Left: Metadata & Title */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-600">
                      ACT-{String(item.id).padStart(4, '0')}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusStyle(item)}`}>
                      {statusLabel(item)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">
                      {item.type}
                    </span>
                    {item.reviewStatus === 'RETURNED_FOR_REVISION' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Manager Comment Available
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-base font-bold text-[#1A2447] group-hover:text-[#2952C4] transition">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-xs text-[#6B7494]">
                    <span className="font-semibold text-slate-700">Incident #{item.incident.id}:</span>{' '}
                    {item.incident.title} • {item.incident.department.name}
                  </p>
                </div>

                {/* Middle: Clinical Priority & Risk Score */}
                <div className="flex items-center gap-6 lg:w-72 lg:justify-between shrink-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7494]">
                      Priority & Risk
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          item.priority === 'CRITICAL'
                            ? 'bg-red-100 text-red-800'
                            : item.priority === 'HIGH'
                            ? 'bg-orange-100 text-orange-800'
                            : item.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {item.completionRisk.score}% Risk
                      </span>
                    </div>
                  </div>

                  {/* Right: Due Date & Countdown */}
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7494]">
                      Due {formatDate(item.dueDate)}
                    </p>
                    <p
                      className={`mt-1 text-xs font-bold ${
                        item.overdue
                          ? 'text-red-700'
                          : item.dueInDays <= 3 && item.status !== 'COMPLETED'
                          ? 'text-amber-700'
                          : 'text-[#1A2447]'
                      }`}
                    >
                      {dueLabel(item)}
                    </p>
                  </div>
                </div>

                {/* Chevron */}
                <div className="hidden lg:block pl-2">
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#2952C4] group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ActionOwnerDashboard;