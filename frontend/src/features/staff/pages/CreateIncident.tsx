import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  useStaffConfig,
  useComplianceAssist,
  useSaveDraft,
  useSubmitStaffIncident,
} from '../hooks/useStaff';
import { useAuthContext } from '../../auth/context/AuthContext';
import type { StaffAssistResult } from '../types/staff.types';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Lock,
  MapPin,
  Paperclip,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

// Exact Category & Dependent Sub-category Map
const CATEGORY_MAP: Record<string, string[]> = {
  'MEDICATION & IV FLUIDS': [
    'Wrong Dose / Rate',
    'Wrong Medication',
    'Omission / Missed Dose',
    'Allergic Reaction',
    'High-Alert Infusion Error',
  ],
  'CLINICAL / PATIENT CARE': [
    'Diagnosis / Treatment Delay',
    'Procedure Complication',
    'Patient Identification Error',
    'Monitoring Failure',
  ],
  'PATIENT SAFETY & FALLS': [
    'Patient Fall (Bed/Bathroom)',
    'Pressure Injury (Bedsores)',
    'Self-Harm / Elopement',
    'Physical Restraint Event',
  ],
  'EQUIPMENT & MEDICAL DEVICES': [
    'Device Failure',
    'Alarm Failure / Silenced',
    'Calibration / Sensor Error',
    'Power / Battery Issue',
  ],
  'INFECTION CONTROL': [
    'Contamination / Sterile Breach',
    'Needle Stick Injury',
    'Isolation Protocol Breach',
    'CLABSI / CAUTI',
  ],
  'FACILITIES & INFRASTRUCTURE': [
    'Power / Generator Glitch',
    'Medical Gas / Oxygen Failure',
    'Slippery Floor / Spill',
    'Fire / Environmental Hazard',
  ],
  'COMMUNICATION & HANDOVER': [
    'Shift Handover Miscommunication',
    'Critical Lab Value Not Relayed',
    'Documentation Error',
  ],
};

const SEVERITY_LEVELS: Array<{
  id: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  label: string;
  desc: string;
}> = [
  { id: 'LOW', label: 'LOW', desc: 'Near miss or minor occurrence with no lasting harm.' },
  { id: 'MEDIUM', label: 'MEDIUM', desc: 'Moderate harm requiring intervention or monitoring.' },
  { id: 'HIGH', label: 'HIGH', desc: 'Severe harm, clinical delay, or surgical intervention.' },
  { id: 'CRITICAL', label: 'CRITICAL', desc: 'Sentinel event, permanent damage, or life threat.' },
];

export const CreateIncident: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const { data: configData, isLoading: isConfigLoading } = useStaffConfig();
  const complianceMutation = useComplianceAssist();
  const saveDraftMutation = useSaveDraft();
  const submitIncidentMutation = useSubmitStaffIncident();

  // Departments list
  const departments = configData?.departments || [];

  // Form State
  const [title, setTitle] = useState('');
  const [occurrenceTime, setOccurrenceTime] = useState(() => {
    const now = new Date();
    // Default to current local time formatted for datetime-local
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
  });
  const [departmentId, setDepartmentId] = useState<number>(user?.departmentId ?? 1);
  const [location, setLocation] = useState('');

  // Classification State
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');

  // Narrative State
  const [description, setDescription] = useState('');
  const [immediateActions, setImmediateActions] = useState('');

  // Attachments State
  const [files, setFiles] = useState<File[]>([]);

  // Compliance Assist State
  const [assistResult, setAssistResult] = useState<StaffAssistResult | null>(null);

  // Status & Modal State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCreatedId, setSuccessCreatedId] = useState<number | null>(null);
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);

  // Check for saved local draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kairos_safety_incident_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title || parsed.description) {
          setDraftBannerVisible(true);
        }
      }
    } catch {}
  }, []);

  // Update default department once config loads
  useEffect(() => {
    if (departments.length > 0 && (!departmentId || !departments.some((d) => d.id === departmentId))) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId]);

  // Dependent Sub-category choices
  const subCategoryOptions = category && CATEGORY_MAP[category] ? CATEGORY_MAP[category] : [];

  // Reset subcategory if category changes
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value;
    setCategory(newCat);
    setSubCategory('');
  };

  // Restore Draft Handler
  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem('kairos_safety_incident_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.occurrenceTime) setOccurrenceTime(parsed.occurrenceTime);
        if (parsed.departmentId) setDepartmentId(Number(parsed.departmentId));
        if (parsed.location) setLocation(parsed.location);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.subCategory) setSubCategory(parsed.subCategory);
        if (parsed.severity) setSeverity(parsed.severity);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.immediateActions) setImmediateActions(parsed.immediateActions);
        toast.success('Draft restored to current workspace.');
      }
    } catch {
      toast.error('Failed to restore draft.');
    } finally {
      setDraftBannerVisible(false);
    }
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem('kairos_safety_incident_draft');
    } catch {}
    setDraftBannerVisible(false);
    toast.success('Saved draft cleared.');
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    setErrorMsg(null);
    try {
      const draftPayload = {
        title,
        occurrenceTime,
        departmentId,
        location,
        category,
        subCategory,
        severity,
        description,
        immediateActions,
      };
      const res = await saveDraftMutation.mutateAsync(draftPayload);
      toast.success(res.message || 'Draft saved successfully. Visible only to you.');
    } catch {
      toast.error('Failed to save draft to server.');
    }
  };

  // Run Automated Compliance Check
  const handleRunComplianceCheck = async () => {
    if (description.trim().length < 10 && title.trim().length < 5) {
      toast.error('Please enter at least a title or part of the clinical narrative first.');
      return;
    }

    try {
      const res = await complianceMutation.mutateAsync({
        title,
        description,
        immediateActions,
        category,
        subCategory,
        severity,
        location,
      });
      setAssistResult(res);
      toast.success('Automated compliance & policy check complete.');
    } catch {
      toast.error('Unable to run compliance check at this time.');
    }
  };

  // Apply Suggested Classification
  const handleApplySuggestions = () => {
    if (!assistResult) return;
    if (assistResult.suggestedCategory && CATEGORY_MAP[assistResult.suggestedCategory]) {
      setCategory(assistResult.suggestedCategory);
      if (assistResult.suggestedSubCategory) {
        setSubCategory(assistResult.suggestedSubCategory);
      }
    }
    if (assistResult.suggestedSeverity) {
      setSeverity(assistResult.suggestedSeverity);
    }
    toast.success('Applied suggested category and severity ratings.');
  };

  // Handle Evidence Files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    if (files.length + selectedFiles.length > 5) {
      setErrorMsg('Maximum 5 evidence files permitted per incident report.');
      return;
    }

    const invalidType = selectedFiles.find(
      (f) => !['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)
    );
    if (invalidType) {
      setErrorMsg('Accepted file types: JPG, PNG, and PDF only.');
      return;
    }

    const oversized = selectedFiles.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      setErrorMsg(`File "${oversized.name}" exceeds the 5MB maximum size limit.`);
      return;
    }

    setErrorMsg(null);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || title.length < 5) {
      setErrorMsg('Incident title must be at least 5 characters.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!category) {
      setErrorMsg('Please select an incident classification category.');
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }

    if (!location.trim()) {
      setErrorMsg('Please specify the exact location of occurrence.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!description.trim() || description.length < 30) {
      setErrorMsg('Chronology and clinical description must be at least 30 characters.');
      window.scrollTo({ top: 400, behavior: 'smooth' });
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());

    // Format combined narrative for database storage while retaining full detail
    const fullNarrative = immediateActions.trim()
      ? `${description.trim()}\n\n[Immediate Actions Taken]:\n${immediateActions.trim()}`
      : description.trim();
    formData.append('description', fullNarrative);

    formData.append('severity', severity);
    // Send full category with subcategory classification
    formData.append('category', subCategory ? `${category} - ${subCategory}` : category);
    formData.append('location', location.trim());
    formData.append('departmentId', String(departmentId));

    if (occurrenceTime) {
      formData.append('occurrenceTime', occurrenceTime);
    }

    files.forEach((file) => {
      formData.append('evidence', file);
    });

    try {
      const created = await submitIncidentMutation.mutateAsync(formData);
      try {
        localStorage.removeItem('kairos_safety_incident_draft');
      } catch {}
      setSuccessCreatedId(created.id);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to submit incident report.';
      setErrorMsg(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Draft Restoration Banner */}
      {draftBannerVisible && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              A saved private draft was detected in this browser. Would you like to restore your previous entries?
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 font-medium rounded-lg text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#0F1E42] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1.5 mb-2.5 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Registry
          </button>
          <div className="text-[11px] font-bold tracking-wider uppercase text-blue-300">
            INCIDENT REPORTING
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Report a Safety Incident
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Save a draft, review clinical details, then submit your formal report.
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2E5D] border border-blue-900/60 text-xs font-semibold text-slate-200">
            <Lock className="w-3.5 h-3.5 text-blue-300" />
            Drafts are visible only to you.
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Guidance is optional.</p>
        </div>
      </div>

      {/* Error Alert Notice */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">
            <span className="font-bold">Submission Requirements Incomplete:</span>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-auto text-red-400 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Event Identity and Routing */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              1. Event identity and routing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only active departments are available; occurrence and report times are stored separately
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Incident Title */}
            <div>
              <label
                htmlFor="incident-title"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Incident title <span className="text-red-500">*</span>
              </label>
              <input
                id="incident-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Concise description of the event"
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                required
              />
            </div>

            {/* Occurrence Date and Time */}
            <div>
              <label
                htmlFor="occurrence-time"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Occurrence date and time <span className="text-red-500">*</span>
              </label>
              <input
                id="occurrence-time"
                type="datetime-local"
                value={occurrenceTime}
                onChange={(e) => setOccurrenceTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                required
              />
            </div>

            {/* Receiving Department */}
            <div>
              <label
                htmlFor="receiving-dept"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Receiving department <span className="text-red-500">*</span>
              </label>
              <select
                id="receiving-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all cursor-pointer"
                required
              >
                {isConfigLoading ? (
                  <option value={departmentId}>Loading departments...</option>
                ) : (
                  departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Exact Location */}
            <div>
              <label
                htmlFor="exact-location"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Exact location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="exact-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ward, room, unit, or facility area"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Classification and Starting Severity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              2. Classification and starting severity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sub-category choices depend on the selected approved category
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* Category */}
            <div>
              <label
                htmlFor="incident-category"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="incident-category"
                value={category}
                onChange={handleCategoryChange}
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all cursor-pointer"
                required
              >
                <option value="">Select category</option>
                {Object.keys(CATEGORY_MAP).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Category (Dependent) */}
            <div>
              <label
                htmlFor="incident-subcategory"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Sub-category <span className="text-red-500">*</span>
              </label>
              <select
                id="incident-subcategory"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                disabled={!category}
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                required
              >
                <option value="">
                  {category ? 'Select dependent sub-category' : 'Select category first'}
                </option>
                {subCategoryOptions.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Initial Severity Segmented Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Initial severity — Staff confirmation required <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {SEVERITY_LEVELS.find((l) => l.id === severity)?.desc}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SEVERITY_LEVELS.map((level) => {
                const isSelected = severity === level.id;
                return (
                  <button
                    type="button"
                    key={level.id}
                    onClick={() => setSeverity(level.id)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 3: Clinical Narrative & Immediate Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              3. Detailed chronology
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Describe what happened, when it happened, immediate response, and relevant context
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="clinical-chronology"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Chronology and clinical description <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    description.trim().length >= 30 ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {description.trim().length}/30 min characters
                </span>
              </div>
              <textarea
                id="clinical-chronology"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a factual chronological account. Do not include unnecessary sensitive identifiers."
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all resize-y"
                required
              />
            </div>

            <div>
              <label
                htmlFor="immediate-actions"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Immediate actions taken
              </label>
              <textarea
                id="immediate-actions"
                rows={3}
                value={immediateActions}
                onChange={(e) => setImmediateActions(e.target.value)}
                placeholder="Immediate clinical response, patient stabilization, containment, notifications made, or mitigations applied..."
                className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all resize-y"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Automated Compliance & Policy Check (De-AI'd Clinical Guidance) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                4. Automated Compliance &amp; Policy Check
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Analyze report narrative to check hospital policy alignment, verify severity, and review precedent events
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunComplianceCheck}
              disabled={complianceMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {complianceMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                  <span>Checking report...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-slate-700" />
                  <span>Check my report</span>
                </>
              )}
            </button>
          </div>

          {/* Structured Clinical Guidance Card */}
          {assistResult && (
            <div className="mt-4 border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-4">
              {/* Completeness & Precedent Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-900 text-sm">
                    {assistResult.completenessScore}%
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Narrative Completeness Score
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Status:{' '}
                      <span className="font-semibold text-blue-700">
                        {assistResult.completenessLevel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-700 bg-white/70 p-2.5 rounded-lg border border-blue-100">
                  <Clock className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>{assistResult.similaritySummary}</span>
                </div>
              </div>

              {/* Policy Compliance Checks */}
              <div>
                <div className="text-xs font-bold text-slate-800 mb-2">
                  Clinical Governance &amp; Policy Checklist:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {assistResult.complianceChecks.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-200"
                    >
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="text-slate-800 font-medium">{item.label}</span>
                        {item.tip && !item.passed && (
                          <p className="text-[10px] text-slate-500 mt-0.5">{item.tip}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Classification */}
              <div className="bg-white rounded-lg p-3 border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900">
                    Policy Classification Assessment:
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    Suggested Category:{' '}
                    <span className="font-semibold text-blue-900">
                      {assistResult.suggestedCategory}
                    </span>
                    {assistResult.suggestedSubCategory && (
                      <>
                        {' '}
                        &rsaquo;{' '}
                        <span className="font-semibold text-blue-900">
                          {assistResult.suggestedSubCategory}
                        </span>
                      </>
                    )}
                    {' '}| Suggested Severity:{' '}
                    <span className="font-bold text-blue-900">
                      {assistResult.suggestedSeverity}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplySuggestions}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-semibold text-xs hover:bg-blue-800 transition-colors shrink-0"
                >
                  Apply Suggested Classification
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Supporting Evidence */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">
              5. Supporting evidence
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Preview or remove files before submission. Authorized users can securely view submitted evidence.
            </p>
          </div>

          <div className="space-y-4">
            {/* Dashed Dropzone */}
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors p-8 text-center cursor-pointer">
              <input
                id="file-dropzone"
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-6 h-6 text-blue-700 mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  Choose JPG, PNG, or PDF files
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Maximum 5 files. 5 MB each
                </p>
              </div>
            </div>

            {/* Attached Files List */}
            {files.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Attached Evidence ({files.length}/5)
                </div>
                <div className="divide-y divide-slate-100 rounded-xl overflow-hidden border border-slate-200 bg-white">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-md"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveDraftMutation.isPending}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saveDraftMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                  <span>Saving draft...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-slate-500" />
                  <span>Save private draft</span>
                </>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitIncidentMutation.isPending}
            className="px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-[#1E3A8A] hover:bg-[#1E293B] shadow-sm transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitIncidentMutation.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Recording Incident...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Confirm &amp; submit incident</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {successCreatedId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 max-w-md w-full text-center shadow-xl border border-slate-200 bg-white">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Safety Incident Logged
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Report{' '}
              <span className="font-mono font-bold text-blue-800">
                #{successCreatedId}
              </span>{' '}
              has been recorded into the safety registry and assigned to the department manager for clinical audit.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSuccessCreatedId(null);
                  setTitle('');
                  setDescription('');
                  setImmediateActions('');
                  setLocation('');
                  setCategory('');
                  setSubCategory('');
                  setFiles([]);
                  setAssistResult(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs transition-colors border border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Log Another Incident
              </button>

              <button
                type="button"
                onClick={() => navigate('/my-incidents')}
                className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-[#0F1E42] hover:bg-[#1E293B] transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                View My Incidents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateIncident;