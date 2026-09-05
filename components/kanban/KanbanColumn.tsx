import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React from 'react';
import { useUpdateTaskMutation } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  accentColor?: string;
  dotColor?: string;
  onDeleteColumn?: (id: string, title: string, count: number) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  tasks,
  dotColor = 'bg-slate-900 shadow-[0_0_6px_rgba(15,23,42,0.6)]',
  onDeleteColumn,
  onMoveLeft,
  onMoveRight,
  canMoveLeft = false,
  canMoveRight = false,
}) => {
  const { data: session } = useSession();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const { setCreateTaskOpen } = useTaskStore();
  const updateTaskMutation = useUpdateTaskMutation();

  const isAdmin = session?.user?.role === 'ADMIN';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (!taskId) return;

    updateTaskMutation.mutate(
      { id: taskId, updates: { status: id } },
      {
        onSuccess: () => {
          toast.success(`Task moved to ${title}!`);
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to move task');
        },
      },
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col min-w-[270px] sm:min-w-[290px] flex-1 rounded-2xl bg-slate-200/50 border border-slate-200/80 transition-all duration-200 min-h-[520px] shrink-0',
        isDragOver && 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-300/50',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
            {title}
          </span>
          <span className="text-xs text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full font-bold shrink-0">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Move Column Left & Right Controls */}
          {isAdmin && (
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-300/60">
              <button
                type="button"
                onClick={onMoveLeft}
                disabled={!canMoveLeft}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  canMoveLeft
                    ? 'text-slate-600 hover:text-indigo-600 hover:bg-white cursor-pointer'
                    : 'text-slate-300 cursor-not-allowed opacity-40',
                )}
                title={canMoveLeft ? `Move "${title}" left` : 'Already at first position'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onMoveRight}
                disabled={!canMoveRight}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  canMoveRight
                    ? 'text-slate-600 hover:text-indigo-600 hover:bg-white cursor-pointer'
                    : 'text-slate-300 cursor-not-allowed opacity-40',
                )}
                title={canMoveRight ? `Move "${title}" right` : 'Already at last position'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setCreateTaskOpen(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title={`Add task to ${title}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {onDeleteColumn && (
                <button
                  type="button"
                  onClick={() => onDeleteColumn(id, title, tasks.length)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title={`Delete "${title}" column (tasks will move to Backlog)`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 flex flex-col gap-2.5 p-3 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
            <p className="text-xs font-medium text-slate-400">Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
};
