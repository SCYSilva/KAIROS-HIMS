// frontend/src/features/manager/hooks/useManager.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi } from '../api/manager.api';
import type { RiskLevel } from '../api/manager.api';
import toast from 'react-hot-toast';

// Hook 1: Fetch Command Centre Dashboard Metrics & Feeds
export const useManagerDashboard = () => {
  return useQuery({
    queryKey: ['manager', 'dashboard'],
    queryFn: () => managerApi.getDashboardData(),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};

// Hook 2: Fetch Clinical Risk Analytics & Charts (/analytics)
export const useManagerAnalytics = () => {
  return useQuery({
    queryKey: ['manager', 'analytics'],
    queryFn: () => managerApi.getAnalytics(),
    refetchOnWindowFocus: false,
  });
};

// Hook 3: Fetch Department Team Personnel Roster (/team)
export const useDepartmentTeam = () => {
  return useQuery({
    queryKey: ['manager', 'team'],
    queryFn: () => managerApi.getDepartmentTeam(),
  });
};

// Hook 4: Mutate (Delegate) User Role
export const useUpdateTeamRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'STAFF' | 'INVESTIGATOR' | 'ACTION_OWNER' }) =>
      managerApi.updateTeamRole(userId, role),
    onSuccess: (data) => {
      toast.success(data.message || 'Staff role updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['manager', 'team'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update staff role.');
    },
  });
};

// Hook 5: Risk Prediction card data: AI prediction + manager override (/incidents/:id/risk-assessment)
// retry is off on purpose: the backend already reports an ML-service outage as `available: false`
export const useIncidentRiskAssessment = (incidentId: number) => {
  return useQuery({
    queryKey: ['manager', 'incident', incidentId, 'risk-assessment'],
    queryFn: () => managerApi.getIncidentRiskAssessment(incidentId),
    enabled: Number.isFinite(incidentId) && incidentId > 0,
    refetchOnWindowFocus: false,
    retry: false,
    // Cache a real prediction for 5 minutes, but never cache an "unavailable" one so reopening retries
    staleTime: (query) => (query.state.data?.prediction.available ? 1000 * 60 * 5 : 0),
  });
};

// Hook 6: Save a human override. The server returns the fresh card data, so we put it straight in the cache.
export const useSetRiskOverride = (incidentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { level: RiskLevel; reason: string }) =>
      managerApi.setIncidentRiskOverride(incidentId, payload),
    onSuccess: (panel) => {
      queryClient.setQueryData(['manager', 'incident', incidentId, 'risk-assessment'], panel);
    },
  });
};

// Hook 7: Remove the override (back to the AI prediction)
export const useClearRiskOverride = (incidentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => managerApi.clearIncidentRiskOverride(incidentId),
    onSuccess: (panel) => {
      queryClient.setQueryData(['manager', 'incident', incidentId, 'risk-assessment'], panel);
    },
  });
};
