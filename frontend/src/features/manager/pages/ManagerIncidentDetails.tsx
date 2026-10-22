// ============================================================
// ManagerIncidentDetails.tsx
// Full detail view for a single incident, available to managers.
// Provides a 4-stage workflow:
//   Tab 1 – Overview & Triage
//   Tab 2 – Investigation & Findings Review
//   Tab 3 – CAPA Actions & Risk Controls
//   Tab 4 – Management Review & Controlled Closure Gate
// ============================================================

// React core hooks
import React, { useState, useEffect } from 'react';
// Router hooks: useParams to read the incident ID from the URL, useNavigate to go back
import { useParams, useNavigate } from 'react-router-dom';
// Manager-specific API client for all backend calls on this page
import { managerApi } from '../api/manager.api';
// TypeScript type imports – only used for type-checking, stripped at build time
import type {
  ManagerIncidentDetail,   // Full incident detail shape returned from the API
  DepartmentUser,          // Represents a staff member in the manager's department
  Severity,                // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  CapaType,                // 'CORRECTIVE' | 'PREVENTIVE'
  CapaPriority,            // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ControlEffectiveness,    // 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE'
  ControlStatus,           // 'PLANNED' | 'IN_PROGRESS' | 'VERIFIED'
  ReviewOutcome,           // 'APPROVED' | 'REVISION_REQUIRED'
} from '../api/manager.api';
// Toast notification library – used for success / error feedback messages
import toast from 'react-hot-toast';
// Lucide icon components used throughout the UI
import {
  CheckCircle,   // Green tick – used for success/verified states
  AlertTriangle, // Warning triangle – used for error / not-found states
  Clock,         // Clock icon – used for unverified or time-related fields
  User,          // Person icon – reporter metadata
  MapPin,        // Location pin – incident location metadata
  Tag,           // Tag icon – incident category metadata
  ShieldAlert,   // Shield with alert – audited correction panel header
  ClipboardList, // Clipboard – triage tab icon
  Search,        // Magnifier – investigation tab icon
  CheckSquare,   // Checkbox – CAPA tab icon
  Lock,          // Padlock – closure gate tab icon and closure button
  ArrowLeft,     // Back arrow – navigate to previous page
  XCircle,       // Red X – used for failed gate indicators and rejection
  FileText,      // File icon – attached evidence list
  AlertCircle,   // Circle alert – request-revision button
} from 'lucide-react';

// ============================================================
// Root component – renders the full incident detail workflow
// ============================================================
export const ManagerIncidentDetails: React.FC = () => {
  // Read the incident ID string from the URL (e.g. /manager/incidents/42)
  const { id } = useParams<{ id: string }>();
  // navigate(-1) is used to go back to the previous page (dashboard)
  const navigate = useNavigate();
  // Convert the string URL param to a number for API calls
  const incidentId = Number(id);

  // ── Core data state ────────────────────────────────────────────────────────
  // The full incident object fetched from the API, or null while loading / not found
  const [incident, setIncident] = useState<ManagerIncidentDetail | null>(null);
  // All staff members in the manager's department (used to assign investigators & action owners)
  const [team, setTeam] = useState<DepartmentUser[]>([]);
  // Controls the full-page loading spinner shown on initial data fetch
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Controls which of the 4 workflow tabs is currently visible
  const [activeTab, setActiveTab] = useState<'triage' | 'investigation' | 'capa' | 'closure'>('triage');

  // ── Tab 1 state: Triage & Audited Correction ──────────────────────────────
  // Free-text rationale the manager must enter before accepting / rejecting / revising
  const [triageRationale, setTriageRationale] = useState('');
  // Toggles the collapsible "Audited Correction" drawer in the header
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  // Form values that mirror the current incident fields so the manager can override them
  // Every change is stored in the clinical audit log with a mandatory justification reason
  const [correctionData, setCorrectionData] = useState({
    title: '',
    severity: 'MEDIUM' as Severity,
    category: '',
    location: '',
    auditReason: '', // Mandatory justification – minimum 10 characters enforced before submit
  });

  // ── Tab 2 state: Investigator Assignment & Findings Review ────────────────
  // ID of the department investigator chosen from the dropdown
  const [selectedInvestigatorId, setSelectedInvestigatorId] = useState<number | ''>('');
  // Manager's review comments on the findings submitted by the investigator
  const [investigationComments, setInvestigationComments] = useState('');

  // ── Tab 3 state: CAPA Actions & Risk Controls ─────────────────────────────
  // Form data for creating a new Corrective/Preventive Action (CAPA)
  const [capaForm, setCapaForm] = useState({
    title: '',
    actionType: 'CORRECTIVE' as CapaType,
    priority: 'MEDIUM' as CapaPriority,
    dueDate: '',
    actionOwnerId: '' as number | '', // Must be set before submitting – validated in handleCreateCapa
    description: '',
  });

  // Form data for logging a new risk barrier control entry
  // Controls are separate from CAPA actions – they track engineering / process barriers
  const [controlForm, setControlForm] = useState({
    controlType: '',
    effectiveness: 'PARTIALLY_EFFECTIVE' as ControlEffectiveness,
    status: 'PLANNED' as ControlStatus,
    failureReason: '',        // Reason the barrier failed (optional)
    requiredImprovement: '',  // What improvement is needed to fix the barrier (optional)
    targetDate: '',
  });

  // ── Tab 4 state: Management Review & Closure Gate ────────────────────────
  // All fields required for the formal management review sign-off
  const [reviewForm, setReviewForm] = useState({
    outcome: 'APPROVED' as ReviewOutcome,
    lessonsLearned: '',      // Key clinical insights documented for institutional learning
    outcomeComments: '',     // Formal management assessment narrative
    followUpMonitoring: '',  // e.g. "30-day clinical audit"
    // Optional dissemination fields – schedule lessons-learned briefings
    audience: '',            // Target audience for the lessons-learned session
    scheduledDate: '',       // When the briefing is planned
  });
  // Free-text closure summary written by the manager – minimum 20 characters enforced
  const [closureSummary, setClosureSummary] = useState('');
  // Global submitting flag – disables all action buttons while any API call is in-flight
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data loading function ─────────────────────────────────────────────────
  // Fetches the incident details and department team in parallel to minimise load time.
  // Also pre-populates the correction form with current incident field values so the
  // manager only needs to change what is wrong rather than retyping everything.
  const loadData = async () => {
    // Guard: if the URL param is missing or not a valid number, do nothing
    if (!incidentId || isNaN(incidentId)) return;
    try {
      setIsLoading(true);
      // Run both API calls concurrently with Promise.all
      const [incidentRes, teamRes] = await Promise.all([
        managerApi.getIncidentDetails(incidentId),
        managerApi.getDepartmentTeam(),
      ]);
      setIncident(incidentRes);
      setTeam(teamRes.users);
      // Pre-fill the audited correction form with the current values of the incident
      setCorrectionData({
        title: incidentRes.title,
        severity: incidentRes.severity,
        category: incidentRes.category,
        location: incidentRes.location,
        auditReason: '', // Always starts blank – manager must justify every correction
      });
      // Pre-select the existing investigator in the dropdown if one is already assigned
      if (incidentRes.investigatorId) {
        setSelectedInvestigatorId(incidentRes.investigatorId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load incident details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data whenever the incident ID in the URL changes
  useEffect(() => {
    loadData();
  }, [incidentId]);

  // ── Loading state – full-page spinner ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        {/* Animated spinner shown while both API calls are pending */}
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading Clinical Governance Record #{incidentId}...</p>
      </div>
    );
  }

  // ── Not found state – shown when incident is null after loading ───────────
  // This happens when the ID does not exist in the manager's department
  if (!incident) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Incident Not Found</h2>
        <p className="text-slate-600 mt-1">Incident #{incidentId} does not exist in your department.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Governance Closure Gate Invariant Checks ──────────────────────────────
  // These derived booleans power the visual gate indicators and the final close button.
  // All three gates PLUS a valid closure summary are required before the incident can be closed.

  // Gate 1: Every CAPA action must be both COMPLETED by the owner AND verified by the manager
  const hasActions = incident.capaActions && incident.capaActions.length > 0;
  const isGate1Satisfied =
    hasActions && incident.capaActions.every((a) => a.status === 'COMPLETED' && a.isVerified);

  // Gate 2: Every risk control barrier must reach the VERIFIED status
  const hasControls = incident.controls && incident.controls.length > 0;
  const isGate2Satisfied =
    hasControls && incident.controls.every((c) => c.status === 'VERIFIED');

  // Gate 3: A management review must exist and its outcome must be APPROVED
  const isGate3Satisfied =
    Boolean(incident.managementReview) && incident.managementReview?.outcome === 'APPROVED';

  // The closure summary textarea must contain at least 20 non-whitespace characters
  const isClosureSummaryValid = closureSummary.trim().length >= 20;
  // Master flag – true only when all gates and the summary are satisfied
  const canFinalClose = isGate1Satisfied && isGate2Satisfied && isGate3Satisfied && isClosureSummaryValid;

  // ── Action Handlers ───────────────────────────────────────────────────────

  /**
   * handleTriage
   * Submits the manager's triage decision (ACCEPT / REVISE / REJECT) for an OPEN incident.
   * Requires a clinical rationale of at least 10 characters before the API call is made.
   * After a successful triage, the rationale field is cleared and data is refreshed.
   */
  const handleTriage = async (decision: 'ACCEPT' | 'REVISE' | 'REJECT') => {
    if (triageRationale.trim().length < 10) {
      toast.error('Please enter a clinical rationale of at least 10 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.triageIncident(incident.id, { decision, rationale: triageRationale });
      toast.success(`Incident triaged as ${decision}`);
      setTriageRationale('');
      loadData(); // Refresh incident so the triage status is reflected immediately
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Triage submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleApplyCorrection
   * Saves an audited correction to core incident fields (title, severity, category, location).
   * Requires a non-trivial audit justification reason (min 10 chars) for every correction.
   * All changes are immutably recorded in the clinical audit log on the backend.
   * Closes the drawer and refreshes data on success.
   */
  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (correctionData.auditReason.trim().length < 10) {
      toast.error('Audit reason must be at least 10 characters long.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.correctRecord(incident.id, correctionData);
      toast.success('Audited record correction saved.');
      setIsCorrectionOpen(false); // Collapse the correction drawer on success
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Record correction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleAssignInvestigator
   * Assigns the selected department member (with INVESTIGATOR role) as the lead
   * investigator for this incident. The dropdown is already filtered to INVESTIGATOR
   * role members only. Converts the selected ID to a number before the API call.
   */
  const handleAssignInvestigator = async () => {
    if (!selectedInvestigatorId) {
      toast.error('Please select an active investigator.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.assignInvestigator(incident.id, { investigatorId: Number(selectedInvestigatorId) });
      toast.success('Lead Investigator assigned successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign investigator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleReviewFindings
   * Manager either approves the investigator's root-cause findings (APPROVE)
   * or sends them back for revision (REVISE) with mandatory review comments.
   * A minimum of 10 characters in the comments field is required in either case.
   */
  const handleReviewFindings = async (decision: 'APPROVE' | 'REVISE') => {
    if (investigationComments.trim().length < 10) {
      toast.error('Review comments must be at least 10 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.reviewInvestigation(incident.id, {
        decision,
        comments: investigationComments,
      });
      toast.success(`Findings review marked as ${decision}`);
      setInvestigationComments(''); // Clear the textarea after submission
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to review findings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleCreateCapa
   * Creates a new Corrective or Preventive Action (CAPA) linked to this incident.
   * An Action Owner must be selected; the owner is responsible for completing the action.
   * On success the form is reset to its default values so another CAPA can be added.
   */
  const handleCreateCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate that an action owner has been selected before submission
    if (!capaForm.actionOwnerId) {
      toast.error('Please assign an Action Owner.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.createCapaAction(incident.id, {
        title: capaForm.title,
        actionType: capaForm.actionType,
        priority: capaForm.priority,
        dueDate: capaForm.dueDate,
        actionOwnerId: Number(capaForm.actionOwnerId), // Cast string select value to number
        description: capaForm.description,
      });
      toast.success('CAPA action logged.');
      // Reset the form to defaults after successful creation
      setCapaForm({
        title: '',
        actionType: 'CORRECTIVE',
        priority: 'MEDIUM',
        dueDate: '',
        actionOwnerId: '',
        description: '',
      });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create CAPA action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleVerifyAction
   * Two-person verification step: the manager verifies (approves) or returns for revision
   * a CAPA action that the action owner has marked as completed.
   * Uses browser's native prompt() for collecting inline notes to keep the UI lightweight.
   * Notes are optional when verifying but REQUIRED when requesting revision.
   * Gate 1 of the closure check will only pass once all actions are VERIFIED.
   */
  const handleVerifyAction = async (actionId: number, decision: 'VERIFY' | 'REVISE') => {
    const notes = prompt(
      decision === 'VERIFY'
        ? 'Enter optional verification approval notes:'
        : 'Enter required reason for revision:'
    );
    // Enforce that revision notes are not empty
    if (decision === 'REVISE' && (!notes || notes.trim().length === 0)) {
      toast.error('Revision comments are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.verifyCapaAction(incident.id, actionId, {
        decision,
        notes: notes || undefined, // Pass undefined instead of empty string when no notes
      });
      toast.success(`Action completion marked as ${decision}`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleCreateControl
   * Records a new risk barrier control entry for this incident.
   * Controls represent engineering or process barriers (e.g. barcode scanning, dual-signoff)
   * and are assessed separately from CAPA actions.
   * Gate 2 of the closure check requires all controls to reach VERIFIED status.
   */
  const handleCreateControl = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await managerApi.createControl(incident.id, controlForm);
      toast.success('Barrier risk control recorded.');
      // Reset the control form to defaults after successful creation
      setControlForm({
        controlType: '',
        effectiveness: 'PARTIALLY_EFFECTIVE',
        status: 'PLANNED',
        failureReason: '',
        requiredImprovement: '',
        targetDate: '',
      });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add control.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleSubmitReview
   * Submits the formal management review sign-off (Gate 3).
   * If an audience is supplied, a lessons-learned dissemination record is also created
   * with a status of SCHEDULED. If no audience is given, dissemination is skipped.
   * An APPROVED outcome is required for Gate 3 to be satisfied.
   */
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await managerApi.submitReview(incident.id, {
        outcome: reviewForm.outcome,
        lessonsLearned: reviewForm.lessonsLearned,
        outcomeComments: reviewForm.outcomeComments,
        followUpMonitoring: reviewForm.followUpMonitoring,
        // Only include dissemination if the manager specified a target audience
        dissemination: reviewForm.audience
          ? {
              audience: reviewForm.audience,
              // Fall back to the current date/time if no specific date was chosen
              scheduledDate: reviewForm.scheduledDate || new Date().toISOString(),
              status: 'SCHEDULED',
            }
          : undefined,
      });
      toast.success('Management review submitted successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleFinalClose
   * Performs the final controlled closure of an incident.
   * This is the most critical action on the page – it permanently closes the incident
   * and cannot be undone. The canFinalClose flag (derived from all 3 gates + summary length)
   * acts as a hard guard; the button is also visually disabled when canFinalClose is false.
   */
  const handleFinalClose = async () => {
    // Double-check the gate conditions even though the button should already be disabled
    if (!canFinalClose) {
      toast.error('All 3 governance gates and a 20+ character closure summary are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await managerApi.closeIncident(incident.id, { closureSummary });
      toast.success('Incident closed and validated under Clinical Governance standards.');
      loadData(); // Refresh data so the UI switches to the "Incident Is Formally Closed" display
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Closure failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Badge colour lookup tables ─────────────────────────────────────────────
  // Maps each severity / status value to a Tailwind CSS class string for the pill badges.
  // Using a lookup object keeps the JSX clean and ensures consistent colouring.
  const severityBadgeClasses: Record<Severity, string> = {
    LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  const statusBadgeClasses: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
    ACCEPTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
    INVESTIGATING: 'bg-purple-100 text-purple-800 border-purple-300',
    PENDING_ACTION: 'bg-amber-100 text-amber-800 border-amber-300',
    UNDER_REVIEW: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    CLOSED: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  // ── JSX Render ────────────────────────────────────────────────────────────
  // Layout:
  //  1. Top Header Banner   – incident ID, title, severity/status badges, back button, correction drawer toggle
  //  2. Audited Correction Drawer – collapsible, conditional on isCorrectionOpen
  //  3. 4-Stage Tab Navigation bar
  //  4. Active Tab Content  – one of: triage / investigation / capa / closure
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                INC-{incident.id.toString().padStart(4, '0')}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{incident.title}</h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                  severityBadgeClasses[incident.severity]
                }`}
              >
                {incident.severity} SEVERITY
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                  statusBadgeClasses[incident.status] || 'bg-slate-100 text-slate-800'
                }`}
              >
                {incident.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCorrectionOpen(!isCorrectionOpen)}
              className="px-3.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
            >
              Audited Correction
            </button>
          </div>
        </div>

        {/* Metadata Strip – four key incident attributes displayed in a responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Reporter</p>
              <p>{incident.reporter?.name} ({incident.reporter?.email})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Location & Dept</p>
              <p>{incident.location} • {incident.department?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Category</p>
              <p>{incident.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-800">Logged On</p>
              <p>{new Date(incident.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Audited Correction Collapsible Drawer ────────────────────────── */}
      {/* Only rendered when the manager clicks the "Audited Correction" button in the header */}
      {isCorrectionOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Audited Record Correction Panel
            </h3>
            <button
              onClick={() => setIsCorrectionOpen(false)}
              className="text-xs text-amber-800 hover:underline"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            Changes to core incident parameters are recorded in the permanent clinical audit log with mandatory justification.
          </p>
          <form onSubmit={handleApplyCorrection} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={correctionData.title}
                onChange={(e) => setCorrectionData({ ...correctionData, title: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Severity</label>
              <select
                value={correctionData.severity}
                onChange={(e) =>
                  setCorrectionData({ ...correctionData, severity: e.target.value as Severity })
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={correctionData.category}
                onChange={(e) => setCorrectionData({ ...correctionData, category: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={correctionData.location}
                onChange={(e) => setCorrectionData({ ...correctionData, location: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Audit Justification / Rationale (Min 10 characters)
              </label>
              <input
                type="text"
                placeholder="Reason for changing severity/category/title"
                value={correctionData.auditReason}
                onChange={(e) =>
                  setCorrectionData({ ...correctionData, auditReason: e.target.value })
                }
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 text-xs"
              >
                Apply Audited Correction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 4-Stage Navigation Tabs ───────────────────────────────────────── */}
      {/* Each tab button sets activeTab; the active tab's content is rendered below */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('triage')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'triage'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> 1. Overview & Triage
        </button>
        <button
          onClick={() => setActiveTab('investigation')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'investigation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search className="w-4 h-4" /> 2. Investigation & Findings
        </button>
        <button
          onClick={() => setActiveTab('capa')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'capa'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> 3. Actions & Controls (CAPA)
        </button>
        <button
          onClick={() => setActiveTab('closure')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'closure'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Lock className="w-4 h-4" /> 4. Review & Closure Gate
        </button>
      </div>
      {/* ── TAB 1: OVERVIEW & TRIAGE ───────────────────────────────────────── */}
      {/* Stage 1 Governance Gate: Displays verbatim reporter narrative and enforces manager triage disposition */}
      {activeTab === 'triage' && (
        <div className="space-y-6">
          {/* Section 1: Clinical Incident Narrative & Attached Evidence */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" /> Clinical Incident Narrative
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Primary verbatim event account provided by reporting healthcare staff.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
                {incident.description ? `${incident.description.length} characters` : 'No text'}
              </span>
            </div>

            {/* Narrative Content with Clinical Accent Border */}
            <div className="border-l-4 border-l-[#1E2B58] bg-slate-50/70 p-4 rounded-r-lg border-y border-r border-slate-200/80">
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
                {incident.description || 'No detailed narrative provided at the time of reporting.'}
              </p>
            </div>

            {/* Attached Clinical Evidence Files */}
            {incident.attachments && incident.attachments.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Attached Clinical Evidence ({incident.attachments.length})
                </h4>
                <div className="flex flex-wrap gap-2.5">
                  {incident.attachments.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg shadow-2xs hover:border-blue-400 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      {file.fileName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Manager Triage Evaluation Gate */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" /> Manager Triage Evaluation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 1 decision gate: validate clinical authenticity, harm exposure, and disposition.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                Phase: {incident.status === 'OPEN' ? 'Action Required' : 'Completed'}
              </span>
            </div>

            {incident.status !== 'OPEN' ? (
              /* Already Triaged View – Formal Audit Confirmation Banner */
              <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/90 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Initial Clinical Triage Completed
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        This incident has been evaluated and advanced to status{' '}
                        <span className="font-bold text-slate-800 uppercase tracking-wide">
                          {incident.status.replace('_', ' ')}
                        </span>.
                      </p>
                    </div>
                  </div>

                  {/* Fast Navigation to Next Operational Stage */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('investigation')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E2B58] hover:bg-[#162044] rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    Proceed to Investigation & Findings &rarr;
                  </button>
                </div>

                {/* Formal Rejection Details if rejected */}
                {incident.rejectionReason && (
                  <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <span className="font-bold block mb-1">Formal Rejection Rationale:</span>
                    <p className="text-rose-700">{incident.rejectionReason}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Pending Triage View – Active Decision Evaluation Form */
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Triage Decision Rationale <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        triageRationale.trim().length >= 10 ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {triageRationale.trim().length} / 10 characters required
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={triageRationale}
                    onChange={(e) => setTriageRationale(e.target.value)}
                    placeholder="Document clinical assessment findings justifying acceptance into investigation, requesting staff clarification, or rejecting the submission..."
                    className="w-full text-xs p-3.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 outline-none transition-all text-slate-800 placeholder-slate-400 bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Rationale will be permanently committed to the immutable clinical audit trail with your digital credential.
                  </p>
                </div>

                {/* Structured Decision Action Bar */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  {/* Accept Primary Action */}
                  <button
                    type="button"
                    onClick={() => handleTriage('ACCEPT')}
                    disabled={isSubmitting || triageRationale.trim().length < 10}
                    className="px-4 py-2.5 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162044] flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Accept for Investigation
                  </button>

                  {/* Request Revision Secondary Action */}
                  <button
                    type="button"
                    onClick={() => handleTriage('REVISE')}
                    disabled={isSubmitting || triageRationale.trim().length < 10}
                    className="px-4 py-2.5 bg-amber-50/70 text-amber-800 border border-amber-300 hover:bg-amber-100/70 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Request Staff Revision
                  </button>

                  {/* Reject Destructive Action */}
                  <button
                    type="button"
                    onClick={() => handleTriage('REJECT')}
                    disabled={isSubmitting || triageRationale.trim().length < 10}
                    className="px-4 py-2.5 bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Reject Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: INVESTIGATION & FINDINGS REVIEW ─────────────────────────── */}
      {/* Stage 2 Governance: Role-guarded investigator delegation and root-cause analysis (RCA) review */}
      {activeTab === 'investigation' && (
        <div className="space-y-6">
          {/* Panel A: Lead Investigator Assignment & Delegation Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600" /> Lead Investigator Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Delegate formal root-cause analysis authority to an authorized departmental investigator.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200 self-start sm:self-auto">
                Status: {incident.investigator ? 'Investigator Assigned' : 'Unassigned'}
              </span>
            </div>
            {/* If an investigator is ALREADY assigned, display an authoritative Delegation Card */}
            {incident.investigator && (
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#1E2B58] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    {incident.investigator.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{incident.investigator.name}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                        Lead Investigator
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{incident.investigator.email}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-600 sm:text-right">
                  <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-100/60 px-2.5 py-1 rounded-md">
                    <Clock className="w-3.5 h-3.5" /> Investigation in Progress
                  </span>
                </div>
              </div>
            )}
            {/* Assignment / Reassignment Controls */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {incident.investigator ? 'Reassign Lead Investigator' : 'Assign Department Investigator'}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-8">
                  <select
                    value={selectedInvestigatorId}
                    onChange={(e) => setSelectedInvestigatorId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all text-slate-700 cursor-pointer"
                  >
                    <option value="">-- Select Active Department Investigator --</option>
                    {team
                      .filter((u) => u.role === 'INVESTIGATOR')
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role}) — {user.email}
                        </option>
                      ))}
                  </select>
                  {team.filter((u) => u.role === 'INVESTIGATOR').length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      No active investigators found in this department. Please assign an investigator in My Team.
                    </p>
                  )}
                </div>
                <div className="md:col-span-4">
                  <button
                    type="button"
                    onClick={handleAssignInvestigator}
                    disabled={isSubmitting || !selectedInvestigatorId}
                    className="w-full px-4 py-2.5 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162044] transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {incident.investigator ? 'Update Lead Assignment' : 'Assign & Begin Investigation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Panel B: Investigator Root-Cause Findings (RCA) & Review Gate */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" /> Root-Cause Analysis (RCA) &amp; Evidence Findings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluate contributing clinical, human, and equipment factors submitted by the investigator.
                </p>
              </div>
              {/* Clinical Review Status Badge */}
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border self-start sm:self-auto ${
                  incident.investigationReviewStatus === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : incident.investigationReviewStatus === 'REVISION_REQUESTED'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                Review Status: {incident.investigationReviewStatus || 'PENDING'}
              </span>
            </div>
            {/* RCA Findings Content Display */}
            {!incident.rootCause && !incident.investigationFindings ? (
              /* State 1: Investigator has not yet submitted findings */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-xs font-bold text-slate-800">
                  Awaiting Investigator Findings Submission
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {incident.investigator
                    ? `${incident.investigator.name} has been assigned as lead investigator. Root-cause findings will appear here once submitted from the Investigator Workspace.`
                    : 'Assign a lead investigator above to initiate formal evidence gathering and root-cause analysis.'}
                </p>
              </div>
            ) : (
              /* State 2: Findings Submitted – Structured Clinical Review Cards */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/80">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Root Cause Category
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {incident.rootCauseCategory || 'Unclassified'}
                    </span>
                  </div>
                  <div className="md:col-span-2 p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/80">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Root Cause Summary
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {incident.rootCause || 'No root cause summary entered.'}
                    </p>
                  </div>
                </div>
                <div className="border-l-4 border-l-[#1E2B58] bg-slate-50/70 p-4 rounded-r-lg border-y border-r border-slate-200/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Detailed Clinical Findings &amp; Contributing Factors
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {incident.investigationFindings || 'No detailed findings provided.'}
                  </p>
                </div>
              </div>
            )}
            {/* Manager Review Disposition Controls */}
            {incident.investigationReviewStatus === 'APPROVED' ? (
              /* Approved State: Audit Stamp & Fast Link to Stage 3 CAPA */
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Findings Formally Approved</h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {incident.investigationReviewComment || 'Clinical findings verified and accepted for CAPA creation.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('capa')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1E2B58] hover:bg-[#162044] rounded-lg shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  Proceed to Actions &amp; Controls (CAPA) &rarr;
                </button>
              </div>
            ) : (
              /* Active Review Form (when findings are submitted or awaiting manager approval) */
              <div className="pt-3 border-t border-slate-100 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Manager Review Assessment <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        investigationComments.trim().length >= 10
                          ? 'text-emerald-600 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {investigationComments.trim().length} / 10 characters required
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={investigationComments}
                    onChange={(e) => setInvestigationComments(e.target.value)}
                    placeholder="Enter formal clinical evaluation of these findings before approving or returning for revision..."
                    className="w-full text-xs p-3.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:ring-1 focus:ring-blue-600/15 outline-none transition-all text-slate-800 placeholder-slate-400 bg-white"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewFindings('APPROVE')}
                    disabled={isSubmitting || investigationComments.trim().length < 10}
                    className="px-4 py-2.5 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162044] flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Approve RCA Findings
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewFindings('REVISE')}
                    disabled={isSubmitting || investigationComments.trim().length < 10}
                    className="px-4 py-2.5 bg-amber-50/70 text-amber-800 border border-amber-300 hover:bg-amber-100/70 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Return for Revision
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ── TAB 3: ACTIONS & CONTROLS (CAPA) ───────────────────────────────── */}
      {/* Three clinical governance sections:
           Section A: CAPA Action Creator Form (Corrective vs. Preventive)
           Section B: CAPA Action Register Ledger with Two-Person Verification Gate
           Section C: Risk Barrier Defense & Systemic Controls (Swiss Cheese Model) */}
      {activeTab === 'capa' && (
        <div className="space-y-6">
          {/* ── SECTION A: CAPA CREATOR FORM ─────────────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
            {/* Clinical Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1E2B58]/10 text-[#1E2B58] flex items-center justify-center font-bold shadow-xs">
                  <CheckSquare className="w-5 h-5 text-[#1E2B58]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                    Section A: Corrective & Preventive Action Creator (CAPA)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Formulate structured remediations, assign departmental accountability, and schedule compliance deadlines.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                ISO 9001 / JCI Quality Standard
              </span>
            </div>
            {/* Form Fields Grid */}
            <form onSubmit={handleCreateCapa} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Action Title */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Action Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Implement dual-signoff policy for IV infusions"
                    value={capaForm.title}
                    onChange={(e) => setCapaForm({ ...capaForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    required
                  />
                </div>
                {/* Action Type: Corrective vs Preventive */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Action Classification <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={capaForm.actionType}
                    onChange={(e) =>
                      setCapaForm({ ...capaForm, actionType: e.target.value as CapaType })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  >
                    <option value="CORRECTIVE">Corrective Action (Immediate Remediation)</option>
                    <option value="PREVENTIVE">Preventive Action (Systemic Risk Elimination)</option>
                  </select>
                </div>
                {/* Priority Selection */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Action Priority <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={capaForm.priority}
                    onChange={(e) =>
                      setCapaForm({ ...capaForm, priority: e.target.value as CapaPriority })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  >
                    <option value="LOW">Low – Routine Process Improvement</option>
                    <option value="MEDIUM">Medium – Standard Remedial Target</option>
                    <option value="HIGH">High – Urgent Clinical Safety Risk</option>
                    <option value="CRITICAL">Critical – Immediate Patient Safety Barrier</option>
                  </select>
                </div>
                {/* Due Date */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Target Completion Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={capaForm.dueDate}
                    onChange={(e) => setCapaForm({ ...capaForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    required
                  />
                </div>
                {/* Designated Action Owner (Department Staff Dropdown) */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Designated Action Owner <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={capaForm.actionOwnerId}
                    onChange={(e) =>
                      setCapaForm({ ...capaForm, actionOwnerId: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    required
                  >
                    <option value="">-- Assign Responsible Department Member --</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — ({u.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
                {/* Detailed Description */}
                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Mandatory Implementation Steps & Expected Deliverables <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide precise clinical instructions, protocol modifications, or technical verifications required to complete this action..."
                    value={capaForm.description}
                    onChange={(e) => setCapaForm({ ...capaForm, description: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all leading-relaxed"
                    required
                  />
                </div>
              </div>
              {/* Form Submission Button */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162144] active:bg-[#0f172a] disabled:opacity-50 transition-colors shadow-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  {isSubmitting ? 'Registering Action...' : 'Create CAPA Action'}
                </button>
              </div>
            </form>
          </div>
          {/* ── SECTION B: CAPA ACTION REGISTER & TWO-PERSON VERIFICATION ───── */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            {/* Header with Verification Progress Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1E2B58]/10 text-[#1E2B58] flex items-center justify-center font-bold shadow-xs">
                  <ShieldAlert className="w-5 h-5 text-[#1E2B58]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                    Section B: CAPA Action Register & Two-Person Verification
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enforces the Four-Eyes Principle. Action Owners complete tasks, but only the Department Manager can independently verify execution for Gate 1 closure.
                  </p>
                </div>
              </div>
              {/* Gate 1 Compliance Meter Pill */}
              {incident.capaActions && incident.capaActions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      isGate1Satisfied
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {isGate1Satisfied ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Gate 1 Verified (Ready)
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Gate 1 Pending Sign-offs
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
            {/* CAPA Table Ledger */}
            {incident.capaActions && incident.capaActions.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-semibold tracking-wider uppercase">
                      <th className="py-3 px-3.5">Action Title & Classification</th>
                      <th className="py-3 px-3.5">Assigned Owner</th>
                      <th className="py-3 px-3.5">Target Due Date</th>
                      <th className="py-3 px-3.5">Execution Status</th>
                      <th className="py-3 px-3.5">Manager Verification</th>
                      <th className="py-3 px-3.5 text-right">Independent Sign-off</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incident.capaActions.map((action) => (
                      <tr key={action.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Title, Classification, and Priority */}
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {action.title}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                action.actionType === 'CORRECTIVE'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}
                            >
                              {action.actionType}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                action.priority === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-800'
                                  : action.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {action.priority}
                            </span>
                          </div>
                          {action.description && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                              "{action.description}"
                            </p>
                          )}
                        </td>
                        {/* Owner details */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                              {action.actionOwner?.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">{action.actionOwner?.name || 'Unassigned'}</div>
                              <div className="text-[10px] text-slate-400 capitalize">
                                {action.actionOwner?.role?.replace('_', ' ').toLowerCase()}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Due Date with Calendar format */}
                        <td className="py-3 px-3.5 font-medium text-slate-700">
                          {new Date(action.dueDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        {/* Execution Status badge */}
                        <td className="py-3 px-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              action.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : action.status === 'IN_PROGRESS'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {action.status}
                          </span>
                        </td>
                        {/* Verification badge */}
                        <td className="py-3 px-3.5">
                          {action.isVerified ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Verified
                              </span>
                              {action.verifiedAt && (
                                <div className="text-[10px] text-slate-400">
                                  {new Date(action.verifiedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Sign-off
                            </span>
                          )}
                        </td>
                        {/* Sign-off Actions (Verify / Return Revision) */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleVerifyAction(action.id, 'VERIFY')}
                              disabled={isSubmitting}
                              title="Sign off and verify completion of this CAPA action"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-md transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Verify
                            </button>
                            <button
                              onClick={() => handleVerifyAction(action.id, 'REVISE')}
                              disabled={isSubmitting}
                              title="Request corrective rework with mandatory clinical feedback notes"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 rounded-md transition-colors disabled:opacity-50"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-600" /> Revise
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center">
                <CheckSquare className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">No CAPA actions registered yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use Section A above to establish clinical corrective and preventive tasks.
                </p>
              </div>
            )}
          </div>
          {/* ── SECTION C: RISK CONTROLS & IMPROVEMENT PLAN ─────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1E2B58]/10 text-[#1E2B58] flex items-center justify-center font-bold shadow-xs">
                  <ShieldAlert className="w-5 h-5 text-[#1E2B58]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                    Section C: Risk Barrier Controls & Improvement Plan
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Engineered & procedural barriers based on the Swiss Cheese Model. Gate 2 requires all barrier controls to reach Verified status.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                Swiss Cheese Barrier Defense
              </span>
            </div>
            {/* Barrier Form */}
            <form onSubmit={handleCreateControl} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Control Type */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Barrier Control Type <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Barcode Medication Verification, EHR Hard-Stop"
                    value={controlForm.controlType}
                    onChange={(e) => setControlForm({ ...controlForm, controlType: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    required
                  />
                </div>
                {/* Barrier Effectiveness */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Barrier Effectiveness <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={controlForm.effectiveness}
                    onChange={(e) =>
                      setControlForm({
                        ...controlForm,
                        effectiveness: e.target.value as ControlEffectiveness,
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  >
                    <option value="EFFECTIVE">Effective (Zero latent breaches detected)</option>
                    <option value="PARTIALLY_EFFECTIVE">Partially Effective (Workarounds possible)</option>
                    <option value="INEFFECTIVE">Ineffective (Complete barrier breach observed)</option>
                  </select>
                </div>
                {/* Control Status */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Implementation Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={controlForm.status}
                    onChange={(e) =>
                      setControlForm({ ...controlForm, status: e.target.value as ControlStatus })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  >
                    <option value="PLANNED">Planned (Scheduled for engineering rollout)</option>
                    <option value="IN_PROGRESS">In Progress (Active pilot / installation)</option>
                    <option value="VERIFIED">Verified (Validated operational barrier)</option>
                  </select>
                </div>
                {/* Target Date */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Target Verification Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={controlForm.targetDate}
                    onChange={(e) => setControlForm({ ...controlForm, targetDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    required
                  />
                </div>
                {/* Failure Reason */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Failure Mode / Latent Defect <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alert fatigue caused clinical bypass"
                    value={controlForm.failureReason}
                    onChange={(e) => setControlForm({ ...controlForm, failureReason: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  />
                </div>
                {/* Required Improvement */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Engineered Improvement Fix <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Implement strict hard-stop biometric check"
                    value={controlForm.requiredImprovement}
                    onChange={(e) =>
                      setControlForm({ ...controlForm, requiredImprovement: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  />
                </div>
              </div>
              {/* Submit Control Button */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162144] active:bg-[#0f172a] disabled:opacity-50 transition-colors shadow-xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-300" />
                  {isSubmitting ? 'Logging Barrier...' : 'Add Risk Control'}
                </button>
              </div>
            </form>
            {/* Barrier Controls Summary Table */}
            {incident.controls && incident.controls.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2.5">
                  Logged Barrier Controls ({incident.controls.length})
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-semibold tracking-wider uppercase">
                        <th className="py-2.5 px-3">Control Barrier Type</th>
                        <th className="py-2.5 px-3">Effectiveness Level</th>
                        <th className="py-2.5 px-3">Barrier Status</th>
                        <th className="py-2.5 px-3">Target Date</th>
                        <th className="py-2.5 px-3">Defect & Improvement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {incident.controls.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {c.controlType}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                c.effectiveness === 'EFFECTIVE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : c.effectiveness === 'PARTIALLY_EFFECTIVE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {c.effectiveness.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                c.status === 'VERIFIED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {c.status === 'VERIFIED' ? (
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Clock className="w-3 h-3 text-amber-600" />
                              )}
                              {c.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {new Date(c.targetDate).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {c.failureReason || c.requiredImprovement ? (
                              <div>
                                {c.failureReason && (
                                  <div>
                                    <span className="font-semibold text-slate-700">Failure:</span> {c.failureReason}
                                  </div>
                                )}
                                {c.requiredImprovement && (
                                  <div>
                                    <span className="font-semibold text-slate-700">Fix:</span> {c.requiredImprovement}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None noted</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ── TAB 4: REVIEW & CLOSURE (THE GOVERNANCE GATE) ───────────────────── */}
      {/* Three clinical governance sections:
           Section A: Management Review Sign-off Form (Gate 3 prerequisite)
           Section B: Lessons Learned Dissemination Scheduling (Institutional Learning)
           Section C: Controlled Clinical Closure Gate (3-Gate validation & Final Closure) */}
      {activeTab === 'closure' && (
        <div className="space-y-6">

          {/* ── SECTION A: MANAGEMENT REVIEW SIGN-OFF ────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
            {/* Clinical Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1E2B58]/10 text-[#1E2B58] flex items-center justify-center font-bold shadow-xs">
                  <ClipboardList className="w-5 h-5 text-[#1E2B58]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                    Section A: Management Review Sign-off
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Formal departmental leadership evaluation, lessons learned consolidation, and follow-up audit planning.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                Gate 3 Prerequisite
              </span>
            </div>

            {/* Existing Approved Review Summary Card (Displays if previously signed off) */}
            {incident.managementReview && (
              <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        incident.managementReview.outcome === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {incident.managementReview.outcome === 'APPROVED' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      Review Outcome: {incident.managementReview.outcome}
                    </span>
                    <span className="text-xs text-slate-500">
                      Reviewed by <strong className="text-slate-700">{incident.managementReview.reviewedBy?.name || 'Manager'}</strong>
                    </span>
                  </div>
                  {incident.managementReview.reviewedAt && (
                    <span className="text-[11px] text-slate-400">
                      {new Date(incident.managementReview.reviewedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="font-semibold text-slate-600">Lessons Learned:</span>
                    <p className="text-slate-800 mt-0.5 italic">"{incident.managementReview.lessonsLearned}"</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Follow-up Monitoring:</span>
                    <p className="text-slate-800 mt-0.5">{incident.managementReview.followUpMonitoring}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Management Review Form */}
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Review Outcome Dropdown */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Review Outcome Decision <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={reviewForm.outcome}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, outcome: e.target.value as ReviewOutcome })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                  >
                    <option value="APPROVED">Approved (Satisfies Closure Gate 3 Validation)</option>
                    <option value="REVISION_REQUIRED">Revision Required (Remand for Additional Remediation)</option>
                  </select>
                </div>

                {/* Follow-up Monitoring */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Follow-up Clinical Monitoring Plan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 30-day clinical audit follow-up on medication reconciliation"
                    value={reviewForm.followUpMonitoring}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, followUpMonitoring: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    required
                  />
                </div>

                {/* Lessons Learned */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Lessons Learned (Clinical Insights) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Document core clinical insights to guide institutional knowledge and prevent cross-ward recurrence..."
                    value={reviewForm.lessonsLearned}
                    onChange={(e) => setReviewForm({ ...reviewForm, lessonsLearned: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all leading-relaxed"
                    required
                  />
                </div>

                {/* Outcome Comments */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Management Assessment Commentary <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Formal executive commentary confirming investigation thoroughness and corrective adequacy..."
                    value={reviewForm.outcomeComments}
                    onChange={(e) => setReviewForm({ ...reviewForm, outcomeComments: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all leading-relaxed"
                    required
                  />
                </div>
              </div>

              {/* ── SECTION B: LESSONS LEARNED DISSEMINATION ─────────────────── */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight">
                    Section B: Lessons Learned Dissemination (Optional Institutional Rollout)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Schedule multi-disciplinary safety briefings across wards or nursing shifts.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Target Audience</label>
                    <input
                      type="text"
                      placeholder="e.g. All Surgical & Nursing Staff, Pharmacy Unit"
                      value={reviewForm.audience}
                      onChange={(e) => setReviewForm({ ...reviewForm, audience: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Scheduled Briefing Date</label>
                    <input
                      type="date"
                      value={reviewForm.scheduledDate}
                      onChange={(e) => setReviewForm({ ...reviewForm, scheduledDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E2B58]/20 focus:border-[#1E2B58] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Management Review Button */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E2B58] text-white text-xs font-semibold rounded-lg hover:bg-[#162144] active:bg-[#0f172a] disabled:opacity-50 transition-colors shadow-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  {isSubmitting ? 'Recording Review...' : 'Submit Management Review'}
                </button>
              </div>
            </form>
          </div>


          {/* ── SECTION C: CONTROLLED CLINICAL CLOSURE GATE ─────────────────── */}
          <div className="bg-[#141C38] border border-slate-800 text-white rounded-xl p-6 shadow-md space-y-6">
            {/* Header with Security Padlock */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    Section C: Controlled Clinical Closure Gate
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      Triple-Gate Lock
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    In accordance with hospital clinical governance rules, this incident cannot be closed until all three gates are fully satisfied.
                  </p>
                </div>
              </div>

              {/* Master Gate Status Pill */}
              <span
                className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  canFinalClose
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                {canFinalClose ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> All Gates Primed & Ready
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-400" /> Gate Locked (Prerequisites Pending)
                  </>
                )}
              </span>
            </div>

            {/* Visual Gate Cards Grid (Interactive Gate Indicators) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Gate 1 Card: CAPA Actions Completed & Verified */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  isGate1Satisfied
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                    : 'bg-slate-800/50 border-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isGate1Satisfied ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-xs">Gate 1: Actions Verified</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isGate1Satisfied
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {incident.capaActions
                      ? `${incident.capaActions.filter((a) => a.status === 'COMPLETED' && a.isVerified).length}/${incident.capaActions.length}`
                      : '0/0'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  All CAPA actions must be marked COMPLETED and VERIFIED by manager sign-off.
                </p>
              </div>

              {/* Gate 2 Card: Barrier Risk Controls Verified */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  isGate2Satisfied
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                    : 'bg-slate-800/50 border-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isGate2Satisfied ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-xs">Gate 2: Controls Verified</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isGate2Satisfied
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {incident.controls
                      ? `${incident.controls.filter((c) => c.status === 'VERIFIED').length}/${incident.controls.length}`
                      : '0/0'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  All departmental risk barrier controls must be assessed and VERIFIED.
                </p>
              </div>

              {/* Gate 3 Card: Formal Management Review Approved */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  isGate3Satisfied
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                    : 'bg-slate-800/50 border-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isGate3Satisfied ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-xs">Gate 3: Review Approved</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isGate3Satisfied
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isGate3Satisfied ? 'Approved' : 'Pending'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Formal Management Review must be documented with outcome APPROVED.
                </p>
              </div>
            </div>

            {/* ── CLOSURE EXECUTION PANEL OR FORMAL CLOSURE CERTIFICATE ───────── */}
            {incident.status === 'CLOSED' ? (
              /* Tamper-Evident Closure Certificate */
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-6 text-xs text-emerald-100 space-y-4 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-500/30 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        Incident Formally Closed & Validated
                      </h4>
                      <p className="text-[11px] text-emerald-300/80">
                        Governed under Hospital Clinical Safety & Risk Compliance Protocol
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-start sm:self-auto">
                    LIFECYCLE COMPLETE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-emerald-300/80 font-medium">Closed At:</span>
                    <p className="text-white font-semibold mt-0.5">
                      {incident.closedAt ? new Date(incident.closedAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-emerald-300/80 font-medium">Authorized Closing Manager:</span>
                    <p className="text-white font-semibold mt-0.5">
                      {incident.closedBy?.name || 'Authorized Manager'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/20">
                  <span className="text-emerald-300/80 font-medium block mb-1">
                    Formal Clinical Closure Summary:
                  </span>
                  <div className="p-3 bg-black/20 rounded-lg border border-emerald-500/30 text-white italic leading-relaxed">
                    "{incident.closureSummary}"
                  </div>
                </div>
              </div>
            ) : (
              /* Active Closure Submission Form */
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-200">
                      Structured Clinical Closure Summary <span className="text-rose-400">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-medium ${
                        isClosureSummaryValid ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {closureSummary.trim().length} / 20 characters {isClosureSummaryValid ? '✓' : 'needed'}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={closureSummary}
                    onChange={(e) => setClosureSummary(e.target.value)}
                    placeholder="Enter formal justification affirming that all patient safety risk controls are in place and verified..."
                    className="w-full text-xs p-3 bg-slate-800/90 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1.5">
                    <span
                      className={
                        isClosureSummaryValid
                          ? 'text-emerald-400 font-semibold flex items-center gap-1'
                          : 'text-slate-400'
                      }
                    >
                      {isClosureSummaryValid ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-400" /> Minimum clinical justification requirement satisfied
                        </>
                      ) : (
                        `Minimum 20 characters required before closure (${Math.max(0, 20 - closureSummary.trim().length)} more needed)`
                      )}
                    </span>
                  </div>
                </div>

                {/* Validate and Close Incident Execution Button */}
                <button
                  onClick={handleFinalClose}
                  disabled={!canFinalClose || isSubmitting}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md ${
                    canFinalClose && !isSubmitting
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/40 hover:shadow-lg'
                      : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/60'
                  }`}
                >
                  <Lock className={`w-4 h-4 ${canFinalClose ? 'text-white' : 'text-slate-500'}`} />
                  {isSubmitting
                    ? 'Validating & Closing Incident...'
                    : 'Validate and Formally Close Incident'}
                </button>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

// Default export – used by the router for lazy-loading this page
export default ManagerIncidentDetails;