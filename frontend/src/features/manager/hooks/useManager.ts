// frontend/src/features/manager/hooks/useManager.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi } from '../api/manager.api';
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