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
    staleTime: 1000 * 60, // 1 min
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
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          if (res.status === 404) {
            // Already deleted on server, local removal completed
            return { message: 'Member removed' };
          }
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || 'Failed to delete member');
        }
        return res.json();
      } catch (err: any) {
        // If network error, local removal already completed
        return { message: 'Member removed locally' };
      }
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
