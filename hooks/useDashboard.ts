import { useQuery } from '@tanstack/react-query';
import type { ActivityLog, DashboardStats } from '@/types';

async function fetchDashboardStats(projectId?: string | null): Promise<DashboardStats> {
  const query = projectId && projectId !== 'ALL' ? `?projectId=${projectId}` : '';
  const res = await fetch(`/api/dashboard/stats${query}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to fetch dashboard stats');
  }
  return res.json();
}

async function fetchActivities(limit = 20): Promise<ActivityLog[]> {
  const res = await fetch(`/api/activities?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to fetch activities');
  }
  return res.json();
}

export function useDashboardStatsQuery(projectId?: string | null) {
  return useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => fetchDashboardStats(projectId),
    staleTime: 1000 * 30, // 30s
  });
}

export function useActivitiesQuery(limit = 20) {
  return useQuery({
    queryKey: ['activities', limit],
    queryFn: () => fetchActivities(limit),
    staleTime: 1000 * 15, // 15s
  });
}
