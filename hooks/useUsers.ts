import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLocalUsers, mergeUsersWithLocal, removeLocalUser, saveLocalUser } from '@/lib/storageSync';
import type { User } from '@/types';

async function fetchUsers(): Promise<User[]> {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const serverUsers: User[] = await res.json();
      return mergeUsersWithLocal(serverUsers);
    }
  } catch {
    // Network or serverless error fallback to local storage
  }
  const local = getLocalUsers();
  return local.length > 0 ? local : [];
}

export function useUsersQuery() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 1000 * 5, // 5s
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
    onSuccess: (newUser) => {
      if (newUser) {
        saveLocalUser(newUser);
      }
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
      removeLocalUser(userId);
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete member');
      }
      return res.json();
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
