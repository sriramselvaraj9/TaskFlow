import { AlertCircle, CheckSquare, FolderKanban, UserPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { useDashboardStatsQuery } from '@/hooks/useDashboard';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useTasksQuery } from '@/hooks/useTasks';
import { cn, formatDate } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';

export const DashboardOverview: React.FC = () => {
  const { data: session } = useSession();
  const {
    selectedProjectId,
    setSelectedTaskId,
    setInviteMemberOpen,
    setSelectedProjectIdForDetail,
  } = useTaskStore();
  const { data: stats, isLoading } = useDashboardStatsQuery(selectedProjectId);
  const { data: projects = [] } = useProjectsQuery();
  const { data: allTasks = [] } = useTasksQuery();
  const { data: tasks = [] } = useTasksQuery({ projectId: selectedProjectId });

  const userName = session?.user?.name || 'User';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-10 w-64 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const effectiveTasks = selectedProjectId && selectedProjectId !== 'ALL' ? tasks : allTasks;
  const userAssignedTasks = session?.user?.id
    ? effectiveTasks.filter((t) => t.assigneeId === session.user.id)
    : [];
  const assignedToMe = session?.user?.id ? userAssignedTasks.length : (stats?.totalTasks ?? 0);
  const openAssignedTasksCount = userAssignedTasks.filter((t) => t.status !== 'DONE').length;
  const overdueCount = stats?.overdueCount ?? 0;
  const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header Greeting + Admin Invite Member Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-slate-500">{greeting}</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
            {userName} 👋
          </h1>
          <div className="text-xs text-slate-400 font-medium mt-1">
            Workspace <span className="text-slate-300">/</span> Dashboard
          </div>
        </div>

        {/* Invite Member Action (Admin Only) */}
        {session?.user?.role === 'ADMIN' && (
          <button
            onClick={() => setInviteMemberOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* 3 KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Assigned to Me */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
              Tasks
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {assignedToMe}
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">Assigned to Me</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              {openAssignedTasksCount} open tasks
            </div>
          </div>
        </div>

        {/* Card 2: Overdue Items */}
        <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              Alert
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {overdueCount}
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">Overdue Items</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              Need immediate attention
            </div>
          </div>
        </div>

        {/* Card 3: Active Projects */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <FolderKanban className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
              Active
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeProjectsCount}
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">Active Projects</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Across all teams</div>
          </div>
        </div>
      </div>

      {/* Recent Tasks & Active Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Tasks */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Tasks</h3>
            <span className="text-xs text-slate-400 font-medium">
              Showing latest {tasks.slice(0, 5).length} items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="py-3 flex items-center justify-between hover:bg-slate-50 px-2.5 rounded-xl cursor-pointer transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      task.status === 'IN_PROGRESS'
                        ? 'bg-indigo-500'
                        : task.status === 'IN_REVIEW'
                          ? 'bg-amber-500'
                          : task.status === 'DONE'
                            ? 'bg-emerald-500'
                            : 'bg-slate-900',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-semibold text-slate-800 truncate"
                      title={task.title}
                    >
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Due {formatDate(task.dueDate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="w-[78px] flex justify-center">
                    <PriorityBadge
                      priority={task.priority}
                      className="w-full justify-center text-center"
                    />
                  </div>
                  <div className="w-[88px] flex justify-center">
                    <StatusBadge
                      status={task.status}
                      className="w-full justify-center text-center"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Active Projects */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Active Projects</h3>
          </div>

          <div className="divide-y divide-slate-100">
            {projects.map((proj) => {
              const projectTaskCount = tasks.filter((t) => t.projectId === proj.id).length;
              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectIdForDetail(proj.id)}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2.5 rounded-xl cursor-pointer transition-colors gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate" title={proj.name}>
                        {proj.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{projectTaskCount} tasks</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    {proj.key}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
