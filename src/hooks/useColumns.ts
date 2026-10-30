import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { CreateColumnFormData } from '@/lib/validators';
import { toast } from '@/store/useToastStore';
import type { BoardColumn } from '@/types';

// Manages all column interactions
export const columnKeys = {
  all: ['columns'] as const,
};

// These asynchronous JavaScript functions make raw HTTP network requests to the Next.js backend API routes.
async function fetchColumns(): Promise<BoardColumn[]> {
  const res = await fetch('/api/columns');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch columns');
  }
  return res.json().catch(() => []);
}

// create columns in the database
async function createColumn(data: CreateColumnFormData, token?: string): Promise<BoardColumn> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/columns', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create column');
  }
  return res.json();
}

// delete column hood request
async function deleteColumn(id: string, token?: string): Promise<{
  message: string;
  movedTasksCount: number;
  deletedColumn: BoardColumn;
}> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/columns/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete column');
  }
  return res.json().catch(() => ({
    message: 'Column deleted',
    movedTasksCount: 0,
    deletedColumn: { id, title: '', dotColor: '', accentColor: '', order: 0, createdAt: '' },
  }));
}

export function useColumnsQuery() {
  return useQuery({
    queryKey: columnKeys.all,
    queryFn: fetchColumns,
    staleTime: 1000 * 5,
  });
}

// used to create the column
export function useCreateColumnMutation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (data: CreateColumnFormData) => createColumn(data, (session as any)?.accessToken),
    onSuccess: (newColumn) => {
      queryClient.invalidateQueries({ queryKey: columnKeys.all });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success(`Column "${newColumn.title}" added successfully!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create column');
    },
  });
}

export function useDeleteColumnMutation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (id: string) => deleteColumn(id, (session as any)?.accessToken),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: columnKeys.all });
      const previousColumns = queryClient.getQueryData<BoardColumn[]>(columnKeys.all);

      if (previousColumns) {
        queryClient.setQueryData(
          columnKeys.all,
          previousColumns.filter((c) => c.id !== deletedId && c.title !== deletedId)
        );
      }

      return { previousColumns };
    },
    onSuccess: (result, deletedId) => {
      queryClient.setQueryData<BoardColumn[] | undefined>(columnKeys.all, (old) =>
        old ? old.filter((c) => c.id !== deletedId && c.title !== deletedId) : []
      );
      queryClient.invalidateQueries({ queryKey: columnKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      if (result.movedTasksCount > 0) {
        toast.success(`Column deleted. ${result.movedTasksCount} task(s) moved to Backlog space.`);
      } else {
        toast.success(`Column "${result.deletedColumn?.title || 'Column'}" deleted.`);
      }
    },
    onError: (err: any, deletedId, context) => {
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        queryClient.setQueryData<BoardColumn[] | undefined>(columnKeys.all, (old) =>
          old ? old.filter((c) => c.id !== deletedId && c.title !== deletedId) : []
        );
        queryClient.invalidateQueries({ queryKey: columnKeys.all });
        toast.success('Column removed from board');
      } else {
        if (context?.previousColumns) {
          queryClient.setQueryData(columnKeys.all, context.previousColumns);
        }
        toast.error(err.message || 'Failed to delete column');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.all });
    },
  });
}

async function reorderColumns(columnIds: string[], token?: string): Promise<BoardColumn[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/columns/reorder', {
    method: 'POST',
    headers,
    body: JSON.stringify({ columnIds }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to reorder columns');
  }
  return res.json().catch(() => []);
}

export function useReorderColumnsMutation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (columnIds: string[]) => reorderColumns(columnIds, (session as any)?.accessToken),
    onMutate: async (newColumnIds) => {
      await queryClient.cancelQueries({ queryKey: columnKeys.all });
      const previousColumns = queryClient.getQueryData<BoardColumn[]>(columnKeys.all);

      if (previousColumns) {
        const reordered = newColumnIds
          .map((id, index) => {
            const col = previousColumns.find((c) => c.id === id);
            return col ? { ...col, order: index } : null;
          })
          .filter(Boolean) as BoardColumn[];

        queryClient.setQueryData(columnKeys.all, reordered);
      }

      return { previousColumns };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousColumns) {
        queryClient.setQueryData(columnKeys.all, context.previousColumns);
      }
      toast.error('Failed to update column position');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.all });
    },
  });
}

