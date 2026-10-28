import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { User } from '@/types';

export interface CreateUserResponse {
  user: User;
  inviteUrl?: string;
  emailSent?: boolean;
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
  const { data: session } = useSession();

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if ((session as any)?.accessToken) {
        headers['Authorization'] = `Bearer ${(session as any).accessToken}`;
      }
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers,
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


export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (userId: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if ((session as any)?.accessToken) {
        headers['Authorization'] = `Bearer ${(session as any).accessToken}`;
      }
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers,
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
