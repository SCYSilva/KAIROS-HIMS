/**
 * Core Incidents React Query Hooks
 *
 * Provides shared, domain-level hooks for incident data retrieval:
 * - useDepartmentIncidents: Fetch incidents list for a department
 * - useIncidentById: Fetch a single incident by ID
 * - useDepartments: Fetch all hospital departments
 * - useUsersByRole: Fetch users by specific role
 */

import { useQuery } from '@tanstack/react-query';
import {
  getDepartmentIncidents,
  getIncidentById,
  getDepartments,
  getUsersByRole,
} from '../api/incident.api';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const incidentKeys = {
  all: ['incidents'] as const,
  byDepartment: (id: number) => [...incidentKeys.all, 'department', id] as const,
  detail: (id: number) => [...incidentKeys.all, 'detail', id] as const,
  departments: () => [...incidentKeys.all, 'departments'] as const,
  usersByRole: (role: string) => [...incidentKeys.all, 'users', role] as const,
};

// ─── Common Incident Hooks ──────────────────────────────────────────────────

/**
 * Fetches all incidents belonging to a specific department.
 */
export const useDepartmentIncidents = (departmentId: number) =>
  useQuery({
    queryKey: incidentKeys.byDepartment(departmentId),
    queryFn: () => getDepartmentIncidents(departmentId),
    enabled: Boolean(departmentId),
  });

/**
 * Fetches a single incident record by its unique ID.
 */
export const useIncidentById = (id: number) =>
  useQuery({
    queryKey: incidentKeys.detail(id),
    queryFn: () => getIncidentById(id),
    enabled: Number.isInteger(id) && id > 0,
  });

/**
 * Fetches the list of all hospital departments.
 */
export const useDepartments = () =>
  useQuery({
    queryKey: incidentKeys.departments(),
    queryFn: getDepartments,
    staleTime: 15 * 60 * 1000, // 15 mins cache
  });

/**
 * Fetches hospital users filtered by role (e.g. INVESTIGATOR, ACTION_OWNER).
 */
export const useUsersByRole = (role: string) =>
  useQuery({
    queryKey: incidentKeys.usersByRole(role),
    queryFn: () => getUsersByRole(role),
    staleTime: 5 * 60 * 1000,
  });
