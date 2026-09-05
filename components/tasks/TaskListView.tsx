import { AlertCircle, Calendar, Edit3, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useState } from 'react';
import { PriorityBadge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useColumnsQuery } from '@/hooks/useColumns';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useDeleteTaskMutation, useUpdateTaskMutation } from '@/hooks/useTasks';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { Task, TaskStatus } from '@/types';

interface TaskListViewProps {
  tasks: Task[];
  isLoading?: boolean;
}

export const TaskListView: React.FC<TaskListViewProps> = ({ tasks, isLoading }) => {
  const { data: session } = useSession();
  const { searchQuery, setSearchQuery, setSelectedTaskId } = useTaskStore();
  const { data: users = [] } = useUsersQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: columns = [] } = useColumnsQuery();
  const updateTaskMutation = useUpdateTaskMutation();
  const deleteTaskMutation = useDeleteTaskMutation();
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, taskId: string) => {
    e.stopPropagation();
    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: e.target.value as TaskStatus },
    });
  };

  const handleOpenDelete = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setTaskToDelete(task);
  };

  const handleConfirmDelete = () => {
    if (!taskToDelete) return;
    deleteTaskMutation.mutate(taskToDelete.id, {
      onSuccess: () => {
        setTaskToDelete(null);
        toast.success('Task deleted successfully!');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="w-full py-8 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 bg-surface-base rounded-xl animate-pulse border border-white/8"
          />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white my-4 shadow-xs">
        <p className="text-slate-800 font-bold text-sm">
          {searchQuery
            ? `No tasks found matching "${searchQuery}"`
            : 'No tasks found matching criteria.'}
        </p>
        <p className="text-slate-400 text-xs mt-1">
          {searchQuery
            ? 'Check for typos or try clearing your search query.'
            : 'Try clearing active filters or resetting the search query.'}
        </p>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white my-4 shadow-card">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <th className="py-3.5 px-3.5 w-[75px] whitespace-nowrap">Key</th>
              <th className="py-3.5 px-3.5 min-w-[180px]">Title & Description</th>
              <th className="py-3.5 px-3.5 w-[130px] whitespace-nowrap">Status</th>
              <th className="py-3.5 px-3.5 w-[110px] whitespace-nowrap">Priority</th>
              <th className="py-3.5 px-3.5 w-[130px] whitespace-nowrap">Assignee</th>
              <th className="py-3.5 px-3.5 w-[115px] whitespace-nowrap">Due Date</th>
              {isAdmin && (
                <th className="py-3.5 px-3.5 pr-5 text-right w-[85px] whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const project = projects.find((p) => p.id === task.projectId);
              const overdue = isOverdue(task.dueDate, task.status);

              // Members can ONLY modify status on tasks assigned to them
              const canModifyStatus =
                isAdmin || (session?.user?.id && task.assigneeId === session.user.id);

              return (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="group hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  {/* Project Key */}
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                      {project?.key || 'TASK'}
                    </span>
                  </td>

                  {/* Title & Description */}
                  <td className="py-3.5 px-3.5 max-w-[220px] lg:max-w-xs">
                    <div
                      className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
                      title={task.title}
                    >
                      {task.title}
                    </div>
                    {task.description && (
                      <div
                        className="text-slate-500 text-[11px] truncate mt-0.5 font-normal"
                        title={task.description}
                      >
                        {task.description}
                      </div>
                    )}
                  </td>

                  {/* Status Dropdown (Editable ONLY if Admin or Assigned Member) */}
                  <td
                    className="py-3.5 px-3.5 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={task.status}
                      disabled={!canModifyStatus}
                      onChange={(e) => handleStatusChange(e, task.id)}
                      title={
                        canModifyStatus
                          ? 'Change task status'
                          : 'Only assigned member or Admin can change status'
                      }
                      className={cn(
                        'border text-xs rounded-lg px-2.5 py-1 text-slate-800 font-medium transition-colors max-w-[130px] truncate',
                        canModifyStatus
                          ? 'bg-slate-50 border-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer hover:bg-slate-100'
                          : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed',
                      )}
                    >
                      <option value="BACKLOG">📦 Backlog</option>
                      {columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <PriorityBadge priority={task.priority} />
                  </td>

                  {/* Assignee */}
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <span className="text-slate-800 font-medium text-xs truncate max-w-[120px] inline-block">
                      {assignee?.name || 'Unassigned'}
                    </span>
                  </td>

                  {/* Due Date */}
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 font-medium text-xs',
                        overdue ? 'text-rose-600 font-bold' : 'text-slate-500',
                      )}
                    >
                      {overdue ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{formatDate(task.dueDate)}</span>
                    </div>
                  </td>

                  {/* Actions Column (Admin Only) */}
                  {isAdmin && (
                    <td
                      className="py-3.5 px-3.5 pr-5 whitespace-nowrap text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTaskId(task.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit task"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDelete(e, task)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        description={`Are you sure you want to delete "${taskToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete Task"
        isLoading={deleteTaskMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setTaskToDelete(null)}
      />
    </div>
  );
};
