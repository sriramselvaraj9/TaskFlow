//useMutation: A React hook used to perform create/update/delete actions (used for POST, PUT, DELETE requests).
//useQuery: A React hook used to fetch and cache data
//useQueryClient: A React hook used to access the query client instance.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'; 
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
    const error = await res.json();
    throw new Error(error.message || 'Failed to fetch columns');
  }
  return res.json();
}
// create columns in the database
async function createColumn(data: CreateColumnFormData): Promise<BoardColumn> {
  const res = await fetch('/api/columns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create column');
  }
  return res.json();
}

// delete column hood request 
async function deleteColumn(id: string): Promise<{
  message: string;
  movedTasksCount: number;
  deletedColumn: BoardColumn;
}> {
  const res = await fetch(`/api/columns/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete column');
  }
  return res.json();
}

export function useColumnsQuery() {
  return useQuery({
    queryKey: columnKeys.all,
    queryFn: fetchColumns,
    staleTime: 1000 * 60 * 5, 
  });
}
 
// used to create the column
export function useCreateColumnMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createColumn,
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

  return useMutation({
    mutationFn: deleteColumn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: columnKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      if (result.movedTasksCount > 0) {
        toast.success(`Column deleted. ${result.movedTasksCount} task(s) moved to Backlog space.`);
      } else {
        toast.success(`Column "${result.deletedColumn.title}" deleted.`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete column');
    },
  });
}

async function reorderColumns(columnIds: string[]): Promise<BoardColumn[]> {
  const res = await fetch('/api/columns/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnIds }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to reorder columns');
  }
  return res.json();
}

export function useReorderColumnsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderColumns,
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
