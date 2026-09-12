import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/types';

export interface CreateUserResponse {
  user: User;
  inviteUrl?: string;
  emailSent?: boolean;
  emailError?: string;
  message?: string;
}

export interface ResendInviteResponse {
  success: boolean;
  user: User;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
  message?: string;
}

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
      password?: string;
      role?: 'ADMIN' | 'MEMBER';
      frontendUrl?: string;
    }) => {
      const payload = {
        ...data,
        frontendUrl:
          data.frontendUrl ||
          (typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : undefined),
      };
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let responseData: any = {};
      try {
        responseData = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) {
          throw new Error(`Server returned error ${res.status}: ${res.statusText || 'Unable to process request'}`);
        }
      }
      if (!res.ok) {
        throw new Error(responseData.message || `Failed to provision team member (${res.status})`);
      }
      return responseData as CreateUserResponse;
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

export function useResendInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId?: string; email?: string; frontendUrl?: string }) => {
      const payload = {
        ...data,
        frontendUrl:
          data.frontendUrl ||
          (typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : undefined),
      };
      const res = await fetch('/api/users/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to generate invitation');
      }
      return responseData as ResendInviteResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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
