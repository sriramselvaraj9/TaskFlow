import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLocalProjects,
  mergeProjectsWithLocal,
  removeLocalProject,
  saveLocalProject,
} from '@/lib/storageSync';
import type { ProjectFormData } from '@/lib/validators';
import type { Project } from '@/types';

async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const serverProjects: Project[] = await res.json();
      return mergeProjectsWithLocal(serverProjects);
    }
  } catch {
    // Network fallback
  }
  const local = getLocalProjects();
  return local.length > 0 ? local : [];
}

async function fetchProject(id: string): Promise<Project> {
  try {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      return res.json();
    }
  } catch {
    // fallback
  }
  const local = getLocalProjects().find((p) => p.id === id);
  if (local) return local;
  throw new Error('Project not found');
}

async function createProject(data: ProjectFormData): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create project');
  }
  const project: Project = await res.json();
  return project;
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 1000 * 60, // 1 min
  });
}

export function useProjectQuery(id?: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => (id ? fetchProject(id) : Promise.reject(new Error('No project ID provided'))),
    enabled: Boolean(id),
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: (newProj) => {
      if (newProj) {
        saveLocalProject(newProj);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

async function updateProject({
  id,
  updates,
}: {
  id: string;
  updates: Partial<Project>;
}): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to update project');
  }
  return res.json();
}

async function deleteProject(id: string): Promise<{ message: string }> {
  removeLocalProject(id);
  const res = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete project');
  }
  return res.json();
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProject,
    onSuccess: (updated) => {
      if (updated) {
        saveLocalProject(updated);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
