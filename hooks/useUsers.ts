import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/types';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch users');
  }
  return res.json();
}

export function useUsersQuery() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 1000 * 5, // 5 seconds
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      designation?: string;
      password: string;
      role?: 'ADMIN' | 'MEMBER';
    }) => {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to provision team member');
      }
      return responseData.user as User;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete member');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

