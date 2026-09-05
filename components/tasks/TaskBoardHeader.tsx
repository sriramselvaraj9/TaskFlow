import {
  Check,
  ChevronDown,
  Filter,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  Plus,
  RotateCcw,
  Search,
  User,
  X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useColumnsQuery } from '@/hooks/useColumns';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn, getUserInitials } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import type { TaskPriority, TaskStatus } from '@/types';

interface TaskBoardHeaderProps {
  totalTasksCount?: number;
  activeView: string;
  onViewChange: (view: string) => void;
}

interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
  avatarText?: string;
}

interface CustomFilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  icon?: React.ReactNode;
}

const CustomFilterDropdown: React.FC<CustomFilterDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];
  const isActive = value !== 'ALL';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer shadow-xs select-none max-w-full',
          isActive
            ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 hover:bg-indigo-100/70 hover:border-indigo-300'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
        )}
      >
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <span
          className={cn(
            'text-[11px] font-medium shrink-0',
            isActive ? 'text-indigo-600 font-bold' : 'text-slate-400',
          )}
        >
          {label}:
        </span>
        {selectedOption?.dotColor && (
          <span className={cn('w-2 h-2 rounded-full shrink-0', selectedOption.dotColor)} />
        )}
        <span className="truncate max-w-[90px] sm:max-w-[130px]">{selectedOption?.label}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180 text-slate-700',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 min-w-[180px] sm:min-w-[200px] max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto divide-y divide-slate-50">
          <div className="p-1 space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left',
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.dotColor && (
                      <span className={cn('w-2 h-2 rounded-full shrink-0', option.dotColor)} />
                    )}
                    {option.avatarText && (
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {option.avatarText}
                      </span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const TaskBoardHeader: React.FC<TaskBoardHeaderProps> = ({
  totalTasksCount = 0,
  activeView,
  onViewChange,
}) => {
  const { data: session } = useSession();
  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    onlyMyTasks,
    setOnlyMyTasks,
    selectedProjectId,
    setSelectedProjectId,
    searchQuery,
    setSearchQuery,
    resetFilters,
    setCreateTaskOpen,
  } = useTaskStore();

  const { data: users = [] } = useUsersQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: columns = [] } = useColumnsQuery();

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (priorityFilter !== 'ALL' ? 1 : 0) +
    (assigneeFilter !== 'ALL' ? 1 : 0) +
    (selectedProjectId !== null ? 1 : 0) +
    (onlyMyTasks ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const isFiltered = activeFilterCount > 0;

  // Options configuration
  const projectOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Projects' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const statusOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'BACKLOG', label: 'Backlog Space', dotColor: 'bg-zinc-500' },
    ...columns.map((c) => ({
      value: c.id,
      label: c.title,
      dotColor: c.dotColor ? c.dotColor.split(' ')[0] : 'bg-slate-400',
    })),
  ];

  const priorityOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Priorities' },
    { value: 'URGENT', label: 'Urgent', dotColor: 'bg-rose-500' },
    { value: 'HIGH', label: 'High', dotColor: 'bg-amber-500' },
    { value: 'MEDIUM', label: 'Medium', dotColor: 'bg-indigo-500' },
    { value: 'LOW', label: 'Low', dotColor: 'bg-slate-400' },
  ];

  const assigneeOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Assignees' },
    ...users.map((u) => ({
      value: u.id,
      label: u.name,
      avatarText: getUserInitials(u.name),
    })),
  ];

  return (
    <div className="flex flex-col gap-3.5 mb-5 sm:mb-6">
      {/* Top row: Title + Search + View toggle + New Task */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Task Board
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
              {totalTasksCount} tasks
            </span>
          </div>

          {/* New Task on mobile (< sm) */}
          {session?.user?.role === 'ADMIN' && (
            <button
              onClick={() => setCreateTaskOpen(true)}
              className="sm:hidden flex items-center gap-1 px-3 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* In-page Search Input */}
          <div className="relative flex-1 sm:w-60 md:w-64 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-0.5 shadow-inner shrink-0">
            <button
              onClick={() => onViewChange('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeView === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Board</span>
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeView === 'list'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">List</span>
            </button>
          </div>

          {/* New Task (Admin Only on >= sm) */}
          {session?.user?.role === 'ADMIN' && (
            <button
              onClick={() => setCreateTaskOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mr-1 select-none shrink-0">
          <Filter className="w-3.5 h-3.5 text-indigo-500" />
          <span>Filters:</span>
        </div>

        {/* Project filter */}
        <CustomFilterDropdown
          label="Project"
          value={selectedProjectId || 'ALL'}
          onChange={(v) => setSelectedProjectId(v === 'ALL' ? null : v)}
          options={projectOptions}
          icon={<FolderKanban className="w-3 h-3 text-slate-400" />}
        />

        {/* Status filter */}
        <CustomFilterDropdown
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as TaskStatus | 'ALL')}
          options={statusOptions}
        />

        {/* Priority filter */}
        <CustomFilterDropdown
          label="Priority"
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as TaskPriority | 'ALL')}
          options={priorityOptions}
        />

        {/* Assignee filter */}
        <CustomFilterDropdown
          label="Assignee"
          value={assigneeFilter}
          onChange={(v) => setAssigneeFilter(v)}
          options={assigneeOptions}
        />

        {/* Only Me Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={onlyMyTasks}
          onClick={() => setOnlyMyTasks(!onlyMyTasks)}
          className={cn(
            'flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs select-none',
            onlyMyTasks
              ? 'bg-teal-50 border-teal-200 text-teal-900 font-bold'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
          )}
          title={onlyMyTasks ? 'Show all tasks' : 'Show only tasks assigned to me'}
        >
          <User className={cn('w-3 h-3', onlyMyTasks ? 'text-teal-600' : 'text-slate-400')} />
          <span>Only Me</span>
          <div
            className={cn(
              'w-6 sm:w-7 h-3.5 sm:h-4 rounded-full transition-colors flex items-center p-0.5',
              onlyMyTasks ? 'bg-[#0d9488]' : 'bg-slate-200',
            )}
          >
            <div
              className={cn(
                'w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full transition-all duration-200 ease-in-out shadow-xs',
                onlyMyTasks
                  ? 'translate-x-2.5 sm:translate-x-3 bg-white'
                  : 'translate-x-0 bg-white',
              )}
            />
          </div>
        </button>

        {/* Reset Filters */}
        {isFiltered && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100/80 rounded-xl border border-rose-200 transition-colors shadow-xs cursor-pointer ml-auto sm:ml-0"
            title="Reset all filters"
          >
            <RotateCcw className="w-3 h-3 text-rose-500" />
            <span>Reset ({activeFilterCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
