/**
 * Core Incident API Module
 *
 * Provides shared, domain-level incident queries:
 * - Fetching hospital departments list
 * - Fetching department incidents
 * - Fetching individual incident record by ID
 * - Fetching hospital users by role
 */

import { apiClient } from '../../../shared/api/axios';
import type { Incident, ApiResponse, Department, User } from '../types/incident';

const API_URL = '/incidents';

/**
 * Fetch the list of all hospital departments
 */
export const getDepartments = async (): Promise<Department[]> => {
  const response = await apiClient.get<ApiResponse<Department[]>>('/departments');
  return response.data.data;
};

/**
 * Fetch all incidents for a specific department
 */
export const getDepartmentIncidents = async (departmentId: number): Promise<Incident[]> => {
  const response = await apiClient.get<ApiResponse<Incident[]>>(
    `${API_URL}/department/${departmentId}`
  );
  return response.data.data;
};

/**
 * Fetch a single incident record by ID
 */
export const getIncidentById = async (id: number): Promise<Incident> => {
  const response = await apiClient.get<ApiResponse<Incident>>(`${API_URL}/${id}`);
  return response.data.data;
};

/**
 * Fetch all users with a specific role (e.g. INVESTIGATOR, ACTION_OWNER, MANAGER)
 */
export const getUsersByRole = async (role: string): Promise<User[]> => {
  const response = await apiClient.get<ApiResponse<User[]>>(`/users/role/${role}`);
  return response.data.data;
};

export const incidentApi = {
  getDepartments,
  getDepartmentIncidents,
  getIncidentById,
  getUsersByRole,
};
