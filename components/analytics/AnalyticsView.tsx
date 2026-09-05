import { BarChart3, CheckCircle2, Clock, PieChart as PieIcon, Users } from 'lucide-react';
import type React from 'react';
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
import { useTaskStore } from '@/store/useTaskStore';

export const AnalyticsView: React.FC = () => {
  const { selectedProjectId } = useTaskStore();
  const { data: stats, isLoading } = useDashboardStatsQuery(selectedProjectId);
  const { data: projects = [] } = useProjectsQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: tasks = [] } = useTasksQuery({ projectId: selectedProjectId });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-10 w-64 bg-slate-200 rounded-xl" />
        <div className="space-y-6">
          <div className="h-64 bg-white rounded-2xl border border-slate-200" />
          <div className="h-80 bg-white rounded-2xl border border-slate-200" />
        </div>
      </div>
    );
  }

  // Status Distribution Data for Recharts PieChart
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

  // Workload per Assignee Data (Computed directly from registered Users and active Tasks)
  const workloadData = users.map((u) => {
    const userTasks = tasks.filter((t) => t.assigneeId === u.id);
    const completedCount = userTasks.filter((t) => t.status === 'DONE').length;
    return {
      name: u.name,
      taskCount: userTasks.length,
      completedCount: completedCount,
    };
  });

  const totalTasks = tasks.length;
  const completedTasks = statusCounts.DONE;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>Workspace Analytics & Insights</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Real-time visual telemetry, task distribution, and team workload audit.
          </p>
        </div>
      </div>

      {/* 4 Summary Stat Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{completionRate}%</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Tasks</span>
            <PieIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{totalTasks}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Across {projects.length} projects
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Members</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Registered workspace team
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Overdue Alert</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-2">
            {stats?.overdueCount ?? 0}
          </div>
          <div className="text-[11px] text-rose-500 mt-1 font-medium">Tasks past deadline</div>
        </div>
      </div>

      {/* Stacked Charts Layout: Displayed One by One for Full Width Visibility */}
      <div className="space-y-6">
        {/* 1. Full-Width Task Distribution by Status Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-base font-bold text-slate-900">Task Distribution by Status</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Breakdown of all workspace tasks across lifecycle states ({tasks.length} total)
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
            {/* Donut Chart */}
            <div className="w-52 h-52 flex-shrink-0 relative flex items-center justify-center mx-auto md:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={80}
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
                <span className="text-2xl font-extrabold text-slate-900">{tasks.length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Tasks
                </span>
              </div>
            </div>

            {/* Custom 4-Card Status Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 flex-1 w-full">
              {pieData.map((item) => (
                <div
                  key={item.name}
                  className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between shadow-2xs hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-slate-600 font-semibold">{item.name}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-extrabold text-slate-900 font-mono">
                      {item.value}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {totalTasks > 0 ? Math.round((item.value / totalTasks) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Full-Width Workload per Assignee Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card">
          <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Workload per Assignee</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Assigned tasks vs. completed tasks across all registered workspace team members (
                {users.length} members)
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
              Total Assignees: <strong className="text-indigo-600 font-bold">{users.length}</strong>
            </div>
          </div>

          {/* Full-width responsive scrollable container for 20+ members */}
          <div className="w-full overflow-x-auto pb-2">
            <div className="h-80" style={{ minWidth: Math.max(users.length * 65, 600) }}>
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
                    name="Total Assigned Tasks"
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
    </div>
  );
};
