import { AlertCircle, Calendar } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { PriorityBadge } from '@/components/ui/Badge';
import { useColumnsQuery } from '@/hooks/useColumns';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useUpdateTaskMutation } from '@/hooks/useTasks';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { Task, TaskStatus } from '@/types';

interface TaskCardProps {
  task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const { data: session } = useSession();
  const { setSelectedTaskId } = useTaskStore();
  const { data: _users = [] } = useUsersQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: columns = [] } = useColumnsQuery();
  const updateTaskMutation = useUpdateTaskMutation();

  const isAdmin = session?.user?.role === 'ADMIN';
  const isAssignedToUser = Boolean(session?.user?.id && task.assigneeId === session.user.id);
  const canModifyStatus = isAdmin || isAssignedToUser;

  const project = projects.find((p) => p.id === task.projectId);
  const overdue = isOverdue(task.dueDate, task.status);

  const getStatusName = (st: string | null) => {
    if (!st) return '';
    if (st === 'BACKLOG') return 'Backlog';
    return columns.find((c) => c.id === st)?.title || st.replace('_', ' ');
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!canModifyStatus) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('text', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleStatusSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (!canModifyStatus) return;

    const newStatus = e.target.value as TaskStatus;
    updateTaskMutation.mutate(
      {
        id: task.id,
        updates: { status: newStatus },
      },
      {
        onSuccess: () => {
          toast.success(`Status updated to ${getStatusName(newStatus)}!`);
        },
      },
    );
  };

  return (
    <div
      draggable={canModifyStatus}
      onDragStart={handleDragStart}
      onClick={() => setSelectedTaskId(task.id)}
      className={cn(
        'group relative bg-white hover:bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-slate-300 transition-all duration-150 shadow-card hover:shadow-md select-none space-y-3',
        canModifyStatus ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        overdue && 'border-rose-300 bg-rose-50/20',
      )}
    >
      {/* Top Header: Project Key + Priority */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
          {project?.key || 'TASK'}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Title & Description */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 leading-snug transition-colors line-clamp-2 break-words">
          {task.title}
        </h4>
        {task.description && (
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed font-normal break-words">
            {task.description}
          </p>
        )}
      </div>

      {/* Footer: Due date + Forward/Backward Stepper & Status Selector */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs gap-2">
        {/* Due Date Indicator */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-medium shrink-0',
            overdue ? 'text-rose-600 font-bold' : 'text-slate-500',
          )}
          title={overdue ? 'Task is overdue!' : `Due ${formatDate(task.dueDate)}`}
        >
          {overdue ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate">{formatDate(task.dueDate)}</span>
        </div>

        {/* Status Dropdown */}
        <div onClick={(e) => e.stopPropagation()} className="relative">
          {canModifyStatus ? (
            <select
              value={task.status}
              onChange={handleStatusSelect}
              title="Change task status"
              className="text-[10px] font-bold rounded-lg px-2 py-1 border transition-colors bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs max-w-[95px] sm:max-w-[110px] truncate"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
              <option value="BACKLOG">📦 Backlog</option>
            </select>
          ) : (
            <span
              title="Read-only: Only assigned member or Admin can change status"
              className="text-[10px] font-bold rounded-lg px-2 py-1 border bg-slate-100 border-slate-200 text-slate-500 select-none inline-block max-w-[95px] truncate"
            >
              {task.status === 'BACKLOG'
                ? 'Backlog'
                : columns.find((c) => c.id === task.status)?.title || task.status.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
