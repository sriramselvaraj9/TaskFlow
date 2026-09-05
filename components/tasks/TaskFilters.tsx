import { BarChart3, LayoutGrid, List as ListIcon, RotateCcw, User as UserIcon } from 'lucide-react';
import type React from 'react';
import { useColumnsQuery } from '@/hooks/useColumns';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import type { TaskPriority, TaskStatus } from '@/types';

interface TaskFiltersProps {
  totalTasksCount?: number;
  activeView: 'kanban' | 'list' | 'analytics';
  onViewChange: (view: 'kanban' | 'list' | 'analytics') => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  totalTasksCount = 0,
  activeView,
  onViewChange,
}) => {
  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    resetFilters,
  } = useTaskStore();

  const { data: users = [] } = useUsersQuery();
  const { data: columns = [] } = useColumnsQuery();

  const isFiltered = statusFilter !== 'ALL' || priorityFilter !== 'ALL' || assigneeFilter !== 'ALL';

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4 border-b border-zinc-800/80">
      {/* Left: View Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 self-start">
        <button
          onClick={() => onViewChange('kanban')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            activeView === 'kanban'
              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Kanban Board</span>
        </button>

        <button
          onClick={() => onViewChange('list')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            activeView === 'list'
              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
          )}
        >
          <ListIcon className="w-3.5 h-3.5" />
          <span>List View</span>
        </button>

        <button
          onClick={() => onViewChange('analytics')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            activeView === 'analytics'
              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
          )}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analytics & Audit</span>
        </button>
      </div>

      {/* Right: Filters & Clear */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1">
          <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'ALL')}
            className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer font-medium"
          >
            <option value="ALL">All</option>
            <option value="BACKLOG">Backlog Space</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1">
          <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
            Priority:
          </span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'ALL')}
            className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer font-medium"
          >
            <option value="ALL">All</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Assignee Filter */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1">
          <UserIcon className="w-3 h-3 text-zinc-500" />
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer font-medium max-w-[120px] truncate"
          >
            <option value="ALL">All Assignees</option>
            <option value="">Unassigned (None)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-850 hover:bg-zinc-800 rounded-lg border border-zinc-700/60 transition-colors"
            title="Reset filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}

        {/* Total Badge */}
        <span className="text-xs text-zinc-500 font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800/80">
          {totalTasksCount} tasks
        </span>
      </div>
    </div>
  );
};
