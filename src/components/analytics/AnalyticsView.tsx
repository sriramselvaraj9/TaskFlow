import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  PieChart as PieIcon,
  RotateCcw,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardStatsQuery } from '@/hooks/useDashboard';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useTasksQuery } from '@/hooks/useTasks';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';

export const AnalyticsView: React.FC = () => {
  const { selectedProjectId, setSelectedProjectId } = useTaskStore();
  const { data: stats, isLoading: isStatsLoading } = useDashboardStatsQuery(selectedProjectId);
  const { data: projects = [], isLoading: isProjectsLoading } = useProjectsQuery();
  const { data: users = [], isLoading: isUsersLoading } = useUsersQuery();
  const { data: tasks = [], isLoading: isTasksLoading } = useTasksQuery({
    projectId: selectedProjectId,
  });

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    if (isProjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProjectDropdownOpen]);

  const isLoading = isStatsLoading || isProjectsLoading || isUsersLoading || isTasksLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-pulse">
        <div className="h-10 w-48 sm:w-64 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 sm:h-32 bg-white rounded-2xl border border-slate-200" />
          ))}
        </div>
        <div className="space-y-4 sm:space-y-6">
          <div className="h-64 bg-white rounded-2xl border border-slate-200" />
          <div className="h-80 bg-white rounded-2xl border border-slate-200" />
        </div>
      </div>
    );
  }

  const currentProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null;
  const isFiltered = Boolean(selectedProjectId && selectedProjectId !== 'ALL');

  // Status Distribution Data for Recharts PieChart (Filtered by selected project)
  const statusCounts: Record<string, number> = {
    BACKLOG: tasks.filter((t) => t.status === 'BACKLOG').length,
    TODO: tasks.filter((t) => t.status === 'TODO').length,
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    IN_REVIEW: tasks.filter((t) => t.status === 'IN_REVIEW').length,
    DONE: tasks.filter((t) => t.status === 'DONE').length,
  };

  const pieData = [
    { name: 'Backlog Space', value: statusCounts.BACKLOG || 0, color: '#a1a1aa' },
    { name: 'To Do', value: statusCounts.TODO || 0, color: '#94a3b8' },
    { name: 'In Progress', value: statusCounts.IN_PROGRESS || 0, color: '#4f46e5' },
    { name: 'In Review', value: statusCounts.IN_REVIEW || 0, color: '#f59e0b' },
    { name: 'Done', value: statusCounts.DONE || 0, color: '#10b981' },
  ].filter((item) => item.value > 0);

  // Scoped Workload per Assignee Data:
  // If project is selected, show members in that project or with assigned tasks in that project
  const relevantUsers = currentProject
    ? users.filter(
        (u) =>
          currentProject.memberIds.includes(u.id) || tasks.some((t) => t.assigneeId === u.id),
      )
    : users;

  const workloadData = relevantUsers.map((u) => {
    const userTasks = tasks.filter((t) => t.assigneeId === u.id);
    const completedCount = userTasks.filter((t) => t.status === 'DONE').length;
    return {
      name: u.name,
      taskCount: userTasks.length,
      completedCount: completedCount,
    };
  });

  const totalTasks = tasks.length;
  const completedTasks = statusCounts.DONE || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate project-scoped active members
  const activeMembersCount = relevantUsers.length;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl">
      {/* Header & Project Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-card">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Workspace Analytics & Insights</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
            {currentProject ? (
              <span>
                Project-specific metrics for{' '}
                <strong className="text-indigo-600 font-bold">{currentProject.name}</strong> (
                {currentProject.key})
              </span>
            ) : (
              'Real-time visual telemetry, task distribution, and team workload across all projects.'
            )}
          </p>
        </div>

        {/* Project Selector & Filter Controls */}
        <div className="flex flex-row items-center gap-2 sm:gap-2.5 self-start sm:self-auto shrink-0" ref={dropdownRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs select-none',
                isFiltered
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100/70 hover:border-indigo-300'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
              )}
            >
              <FolderKanban className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-[11px] text-slate-400 font-medium">Project:</span>
              <span className="font-bold truncate max-w-[130px] sm:max-w-[180px]">
                {currentProject ? currentProject.name : 'All Projects'}
              </span>
              {currentProject && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                  {currentProject.key}
                </span>
              )}
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0',
                  isProjectDropdownOpen && 'rotate-180 text-slate-700',
                )}
              />
            </button>

            {/* Dropdown Menu */}
            {isProjectDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 sm:w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-scale-in max-h-72 overflow-y-auto">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Filter by Project
                </div>

                {/* Option: All Projects */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(null);
                    setIsProjectDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left',
                    !isFiltered
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                    <span>All Projects ({projects.length})</span>
                  </div>
                  {!isFiltered && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* Individual Projects List */}
                {projects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setIsProjectDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left',
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {proj.key}
                        </span>
                        <span className="truncate">{proj.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reset Filter Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-2 bg-rose-50 hover:bg-rose-100/80 rounded-xl border border-rose-200 transition-colors shadow-2xs cursor-pointer"
              title="Clear project filter"
            >
              <RotateCcw className="w-3 h-3 text-rose-500" />
              <span className="hidden sm:inline">All Projects</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary Stat Metrics Cards: 2 Columns in a Row on Mobile/Tablets, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Completion Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4.5 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Completion Rate
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">
            {completionRate}%
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Total Tasks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4.5 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Total Tasks
            </span>
            <PieIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">
            {totalTasks}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 font-medium truncate">
            {currentProject ? `Project ${currentProject.key}` : `Across ${projects.length} projects`}
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4.5 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              {currentProject ? 'Project Team' : 'Active Members'}
            </span>
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">
            {activeMembersCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 font-medium truncate">
            {currentProject ? 'Assigned to project' : 'Registered workspace team'}
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4.5 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Overdue Alert
            </span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-1.5 sm:mt-2">
            {stats?.overdueCount ?? 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-rose-500 mt-0.5 sm:mt-1 font-medium truncate">
            Tasks past deadline
          </div>
        </div>
      </div>

      {/* Stacked Charts Layout */}
      {totalTasks === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center shadow-2xs">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">
            {currentProject ? `No tasks found for ${currentProject.name}` : 'No tasks in workspace'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {currentProject
              ? 'Create tasks for this project on the Task Board to view analytics telemetry.'
              : 'Add tasks to your projects to generate charts and workload analytics.'}
          </p>
          {isFiltered && (
            <button
              onClick={() => setSelectedProjectId(null)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Show All Projects</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* 1. Full-Width Task Distribution by Status Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-card">
            <div className="border-b border-slate-100 pb-3 sm:pb-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Task Distribution by Status
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
                  {currentProject ? (
                    <span>
                      Lifecycle distribution for <strong>{currentProject.name}</strong> ({totalTasks}{' '}
                      total tasks)
                    </span>
                  ) : (
                    `Breakdown of all workspace tasks across lifecycle states (${totalTasks} total)`
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 justify-between">
              {/* Donut Chart */}
              <div className="w-44 h-44 sm:w-52 sm:h-52 flex-shrink-0 relative flex items-center justify-center mx-auto md:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={74}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Inner Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {totalTasks}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Tasks
                  </span>
                </div>
              </div>

              {/* Custom 4-Card Status Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 flex-1 w-full">
                {pieData.map((item) => (
                  <div
                    key={item.name}
                    className="p-3 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between shadow-2xs hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <span
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[11px] sm:text-xs text-slate-600 font-semibold truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
                        {item.value}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                        {totalTasks > 0 ? Math.round((item.value / totalTasks) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Full-Width Workload per Assignee Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-card">
            <div className="border-b border-slate-100 pb-3 sm:pb-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Workload per Assignee
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
                  {currentProject ? (
                    <span>
                      Assigned vs. completed tasks in <strong>{currentProject.name}</strong> across{' '}
                      {relevantUsers.length} team member{relevantUsers.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    `Assigned vs. completed tasks across all registered workspace team members (${users.length} members)`
                  )}
                </p>
              </div>
              <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                Assignees: <strong className="text-indigo-600 font-bold">{relevantUsers.length}</strong>
              </div>
            </div>

            {/* Full-width responsive scrollable container */}
            <div className="w-full overflow-x-auto pb-2">
              <div
                className="h-72 sm:h-80"
                style={{ minWidth: Math.max(relevantUsers.length * 65, 480) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={workloadData}
                    margin={{ top: 15, right: 20, left: -15, bottom: 25 }}
                    barGap={6}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      tickFormatter={(val: string) =>
                        val && val.length > 12 ? `${val.slice(0, 11)}…` : val
                      }
                      interval={0}
                      height={40}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <Tooltip
                      labelFormatter={(label) => `Member: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{
                        fontSize: '12px',
                        fontWeight: '600',
                        paddingTop: '16px',
                      }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="taskCount"
                      name="Assigned Tasks"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="completedCount"
                      name="Completed Tasks"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

