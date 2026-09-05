import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskFormData } from '@/lib/validators';
import type { Task, TaskPriority, TaskStatus } from '@/types';

interface TaskFilterParams {
  projectId?: string | null;
  status?: TaskStatus | 'ALL';
  priority?: TaskPriority | 'ALL';
  assigneeId?: string | 'ALL';
  search?: string;
}

async function fetchTasks(params: TaskFilterParams): Promise<Task[]> {
  const query = new URLSearchParams();
  if (params.projectId && params.projectId !== 'ALL') query.set('projectId', params.projectId);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.priority && params.priority !== 'ALL') query.set('priority', params.priority);
  if (params.assigneeId && params.assigneeId !== 'ALL') query.set('assigneeId', params.assigneeId);
  if (params.search) query.set('search', params.search);

  const res = await fetch(`/api/tasks?${query.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to fetch tasks');
  }
  return res.json();
}

async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to fetch task');
  }
  return res.json();
}

async function createTask(data: CreateTaskFormData): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create task');
  }
  return res.json();
}

async function updateTask({ id, updates }: { id: string; updates: Partial<Task> }): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to update task');
  }
  return res.json();
}

async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete task');
  }
}

export function useTasksQuery(params: TaskFilterParams = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => fetchTasks(params),
    staleTime: 1000 * 5, // 5s
  });
}

export function useTaskQuery(id?: string | null) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => (id ? fetchTask(id) : Promise.reject(new Error('No task ID provided'))),
    enabled: Boolean(id),
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTask,
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      await queryClient.cancelQueries({ queryKey: ['task', id] });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });

      // Optimistically update to the new value in all cached task lists
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (oldTasks) => {
        if (!oldTasks) return [];
        return oldTasks.map((task) => (task.id === id ? { ...task, ...updates } : task));
      });

      // Optimistically update single task query
      queryClient.setQueryData<Task>(['task', id], (oldTask) => {
        if (!oldTask) return oldTask;
        return { ...oldTask, ...updates };
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data, variables) => {
      // Direct replacement with server updated entity
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (oldTasks) => {
        if (!Array.isArray(oldTasks)) return oldTasks;
        return oldTasks.map((task) => (task.id === variables.id ? { ...task, ...data } : task));
      });
      queryClient.setQueryData(['task', variables.id], data);
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success to keep server synced
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
