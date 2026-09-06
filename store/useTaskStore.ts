import { create } from 'zustand';
// Global state management (Zustand).
import type { TaskPriority, TaskStatus } from '@/types';

interface TaskStoreState {
  // Filter & Search State
  selectedProjectId: string | null;
  statusFilter: TaskStatus | 'ALL';
  priorityFilter: TaskPriority | 'ALL';
  assigneeFilter: string | 'ALL';
  onlyMyTasks: boolean;
  searchQuery: string;
  viewMode: 'kanban' | 'list';

  // UI Modal & Panel State
  isCreateTaskOpen: boolean;
  isCreateProjectOpen: boolean;
  isInviteMemberOpen: boolean;
  selectedTaskId: string | null;
  selectedProjectIdForDetail: string | null;
  
  // Actions
  setSelectedProjectId: (id: string | null) => void;
  setStatusFilter: (status: TaskStatus | 'ALL') => void;
  setPriorityFilter: (priority: TaskPriority | 'ALL') => void;
  setAssigneeFilter: (assigneeId: string | 'ALL') => void;
  setOnlyMyTasks: (onlyMy: boolean) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'kanban' | 'list') => void;
  resetFilters: () => void;

  setCreateTaskOpen: (open: boolean) => void;
  setCreateProjectOpen: (open: boolean) => void;
  setInviteMemberOpen: (open: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSelectedProjectIdForDetail: (id: string | null) => void;
}

export const useTaskStore = create<TaskStoreState>((set) => ({
  selectedProjectId: null,
  statusFilter: 'ALL',
  priorityFilter: 'ALL',
  assigneeFilter: 'ALL',
  onlyMyTasks: false,
  searchQuery: '',
  viewMode: 'kanban',

  isCreateTaskOpen: false,
  isCreateProjectOpen: false,
  isInviteMemberOpen: false,
  selectedTaskId: null, // Initial state
  selectedProjectIdForDetail: null,

  // functions
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setPriorityFilter: (priority) => set({ priorityFilter: priority }),
  setAssigneeFilter: (assigneeId) => set({ assigneeFilter: assigneeId }),
  setOnlyMyTasks: (onlyMy) => set({ onlyMyTasks: onlyMy }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),
  resetFilters: () =>
    set({
      statusFilter: 'ALL',
      priorityFilter: 'ALL',
      assigneeFilter: 'ALL',
      onlyMyTasks: false,
      searchQuery: '',
    }),

  setCreateTaskOpen: (open) => set({ isCreateTaskOpen: open }),
  setCreateProjectOpen: (open) => set({ isCreateProjectOpen: open }),
  setInviteMemberOpen: (open) => set({ isInviteMemberOpen: open }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }), // The setter action
  setSelectedProjectIdForDetail: (id) => set({ selectedProjectIdForDetail: id }),
}));
