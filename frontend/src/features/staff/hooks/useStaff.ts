/**
 * Staff React Query Hooks
 *
 * Provides reactive state management and API integration for Hospital Staff:
 * - useStaffConfig: Loads department dropdown data and incident classification mapping
 * - useComplianceAssist: Clinical policy check and compliance heuristics mutation
 * - useSaveDraft: Auto-saves and persists drafts locally and remotely
 * - useSubmitStaffIncident: Submits finalized incident with evidence files
 * - useMyIncidents: Loads list of incidents reported by the logged-in staff member
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffConfig,
  runComplianceAssist,
  saveStaffDraft,
  submitStaffIncident,
  getMyIncidents,
} from '../api/staff.api';

export const staffKeys = {
  all: ['staff'] as const,
  config: () => [...staffKeys.all, 'config'] as const,
  myIncidents: () => [...staffKeys.all, 'myIncidents'] as const,
};

/**
 * Fetches staff configuration: departments list and optional categories map.
 * Used by CreateIncident page.
 */
export const useStaffConfig = () =>
  useQuery({
    queryKey: staffKeys.config(),
    queryFn: getStaffConfig,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

/**
 * Runs the automated compliance & policy check against the report narrative.
 * Returns classification suggestions and clinical governance checklist.
 */
export const useComplianceAssist = () =>
  useMutation({
    mutationFn: runComplianceAssist,
  });

/**
 * Saves a private draft of the incident form to localStorage and server.
 */
export const useSaveDraft = () =>
  useMutation({
    mutationFn: saveStaffDraft,
  });

/**
 * Formally submits a staff incident report (with optional evidence files).
 * On success, automatically invalidates the staff "my incidents" query.
 */
export const useSubmitStaffIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitStaffIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.myIncidents() });
    },
  });
};

/**
 * Fetches all incidents submitted by the currently authenticated staff member.
 */
export const useMyIncidents = () =>
  useQuery({
    queryKey: staffKeys.myIncidents(),
    queryFn: getMyIncidents,
  });
