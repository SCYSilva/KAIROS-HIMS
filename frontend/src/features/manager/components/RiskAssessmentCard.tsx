// frontend/src/features/manager/components/RiskAssessmentCard.tsx

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useIncidentRiskAssessment,
  useSetRiskOverride,
  useClearRiskOverride,
} from '../hooks/useManager';
import type { IncidentRiskAssessment, IncidentRiskPanel, RiskLevel } from '../api/manager.api';

const LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];
const MIN_REASON_LENGTH = 10; // same rule as the other manager comment boxes

// Same colour language as the severity badges used across the manager screens
const LEVEL_BADGE: Record<RiskLevel, string> = {
  Low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Medium: 'bg-amber-100 text-amber-800 border-amber-300',
  High: 'bg-orange-100 text-orange-800 border-orange-300',
  Critical: 'bg-rose-100 text-rose-800 border-rose-300',
};

const LevelPill: React.FC<{ level: RiskLevel }> = ({ level }) => (
  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${LEVEL_BADGE[level]}`}>
    {level}
  </span>
);

const pluralise = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

// One plain sentence explaining what the AI looked at
const describeBasis = (a: IncidentRiskAssessment): string => {
  const { severity, recurrence, duration } = a.breakdown;
  if (!recurrence || !duration) {
    return `Reported severity ${severity.value} only. No similar past incidents were found to compare with.`;
  }
  const days = Math.round(duration.avgResolutionDays * 10) / 10;
  return (
    `Reported severity ${severity.value}; ` +
    `${pluralise(recurrence.sameDepartmentMatches, 'similar incident', 'similar incidents')} in this department ` +
    `(${recurrence.totalMatches} across the hospital); ` +
    `similar incidents took about ${days} days to close.`
  );
};

const formatWhen = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'an unknown time';

// ── Presentational view (controlled; no data fetching, so every state is easy to render) ──
export interface RiskAssessmentViewProps {
  panel: IncidentRiskPanel | undefined;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRetry: () => void;
  selectedLevel: RiskLevel | '';
  onSelectLevel: (value: RiskLevel | '') => void;
  reason: string;
  onReasonChange: (value: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onRevert: () => void;
}

export const RiskAssessmentView: React.FC<RiskAssessmentViewProps> = ({
  panel,
  isLoading,
  isError,
  isRefetching,
  onRetry,
  selectedLevel,
  onSelectLevel,
  reason,
  onReasonChange,
  isSaving,
  onSave,
  onRevert,
}) => {
  const prediction = panel?.prediction;
  const assessment = prediction && prediction.available ? prediction.assessment : null;
  const override = panel?.override ?? null;
  const finalLevel = panel?.finalLevel ?? null;
  const aiLevel = assessment ? assessment.riskLevel : null;

  const isChange = selectedLevel !== '' && selectedLevel !== finalLevel;
  const matchesAiWhileOverridden = override !== null && selectedLevel !== '' && selectedLevel === aiLevel;
  const showReason = isChange && !matchesAiWhileOverridden;
  const reasonOk = reason.trim().length >= MIN_REASON_LENGTH;
  const canSave = showReason && reasonOk && !isSaving;

  const retryButton = (
    <button
      type="button"
      onClick={onRetry}
      disabled={isRefetching}
      className="ml-1 font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
    >
      {isRefetching ? 'Trying again…' : 'Try again'}
    </button>
  );

  return (
    <section
      aria-labelledby="risk-prediction-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="risk-prediction-heading" className="text-sm font-bold text-slate-800">
          Risk Prediction
        </h3>
        {finalLevel ? (
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${LEVEL_BADGE[finalLevel]}`}
          >
            {finalLevel} risk{override ? ' (manager override)' : ''}
          </span>
        ) : (
          !isLoading && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-slate-100 text-slate-600 border-slate-300">
              Not rated yet
            </span>
          )
        )}
      </div>

      {/* Summary box: same look as the root-cause summary lower on this tab */}
      <div
        aria-live="polite"
        className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600"
      >
        {isLoading && <p role="status">Checking similar past incidents…</p>}

        {isError && (
          <p>
            <span className="font-semibold text-slate-700">AI Prediction:</span> the risk prediction could
            not be loaded.
            {retryButton}
          </p>
        )}

        {panel && assessment && (
          <>
            <p className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700">AI Prediction:</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {assessment.totalScore}%
                <span className="sr-only"> predicted risk</span>
              </span>
              <LevelPill level={assessment.riskLevel} />
            </p>
            <p>
              <span className="font-semibold text-slate-700">Based on:</span> {describeBasis(assessment)}
            </p>
            {assessment.computedLevelBeforeFloor !== assessment.riskLevel && (
              <p>
                <span className="font-semibold text-slate-700">Note:</span> shown as {assessment.riskLevel} because
                the reported severity is {assessment.breakdown.severity.value}. The percentage alone would give{' '}
                {assessment.computedLevelBeforeFloor}.
              </p>
            )}
          </>
        )}

        {panel && prediction && !prediction.available && (
          <p>
            <span className="font-semibold text-slate-700">AI Prediction:</span> not available right now.{' '}
            {prediction.message} You can still set the risk level yourself below.
            {retryButton}
          </p>
        )}

        {override && (
          <p>
            <span className="font-semibold text-slate-700">Manager Override:</span>{' '}
            <LevelPill level={override.level} /> set by{' '}
            <span className="font-semibold text-slate-800">{override.overriddenBy?.name ?? 'a manager'}</span> on{' '}
            {formatWhen(override.overriddenAt)}.
            {override.aiLevelAtOverride && (
              <>
                {' '}
                The AI predicted {override.aiLevelAtOverride}
                {override.aiScoreAtOverride !== null ? ` (${override.aiScoreAtOverride}%)` : ''} at that
                time.
              </>
            )}{' '}
            Reason: “{override.reason}”
          </p>
        )}
      </div>

      {/* Override controls: same layout as the Lead Investigator Assignment card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label htmlFor="risk-level-select" className="block text-xs font-semibold text-slate-700 mb-1">
            Edit Risk Level (change it if you disagree with the AI)
          </label>
          <select
            id="risk-level-select"
            value={selectedLevel}
            onChange={(e) => onSelectLevel(e.target.value as RiskLevel | '')}
            disabled={!panel || isSaving}
            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white disabled:opacity-60"
          >
            <option value="">-- Select Risk Level --</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
                {level === aiLevel ? ' (AI prediction)' : ''}
                {override && level === override.level ? ' (current override)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save Risk Level'}
        </button>
      </div>

      {selectedLevel !== '' && selectedLevel === finalLevel && (
        <p className="text-[11px] text-slate-500">That is already the current risk level.</p>
      )}
      {matchesAiWhileOverridden && (
        <p className="text-[11px] text-slate-500">
          This matches the AI prediction. Use “Revert to AI prediction” below instead.
        </p>
      )}

      {showReason && (
        <div>
          <label htmlFor="risk-override-reason" className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for changing the risk level (Min {MIN_REASON_LENGTH} characters)
          </label>
          <textarea
            id="risk-override-reason"
            rows={2}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Explain why you are changing the AI risk level. This is saved in the audit trail."
            className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {override && (
        <button
          type="button"
          onClick={onRevert}
          disabled={isSaving}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Revert to AI prediction
        </button>
      )}
    </section>
  );
};

// ── Connected card: shown at the top of "2. Investigation & Findings" ─────────
export const RiskAssessmentCard: React.FC<{ incidentId: number }> = ({ incidentId }) => {
  const { data, isLoading, isError, isFetching, refetch } = useIncidentRiskAssessment(incidentId);
  const setOverride = useSetRiskOverride(incidentId);
  const clearOverride = useClearRiskOverride(incidentId);

  const [selectedLevel, setSelectedLevel] = useState<RiskLevel | ''>('');
  const [reason, setReason] = useState('');

  const resetForm = () => {
    setSelectedLevel('');
    setReason('');
  };

  // Server errors are already shown by the global axios interceptor, so only success is announced here
  const handleSave = () => {
    if (selectedLevel === '') return;
    setOverride.mutate(
      { level: selectedLevel, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`Risk level set to ${selectedLevel}`);
          resetForm();
        },
      }
    );
  };

  const handleRevert = () => {
    clearOverride.mutate(undefined, {
      onSuccess: () => {
        toast.success('Reverted to the AI prediction');
        resetForm();
      },
    });
  };

  return (
    <RiskAssessmentView
      panel={data}
      isLoading={isLoading}
      isError={isError}
      isRefetching={isFetching && !isLoading}
      onRetry={() => {
        void refetch();
      }}
      selectedLevel={selectedLevel}
      onSelectLevel={setSelectedLevel}
      reason={reason}
      onReasonChange={setReason}
      isSaving={setOverride.isPending || clearOverride.isPending}
      onSave={handleSave}
      onRevert={handleRevert}
    />
  );
};
