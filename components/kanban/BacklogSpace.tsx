import { Archive, ChevronDown, ChevronUp, FolderArchive, Sparkles } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useUpdateTaskMutation } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { toast } from '@/store/useToastStore';
import type { BoardColumn, Task } from '@/types';
import { TaskCard } from './TaskCard';

interface BacklogSpaceProps {
  tasks: Task[];
  columns?: BoardColumn[];
}

export const BacklogSpace: React.FC<BacklogSpaceProps> = ({ tasks }) => {
  const backlogTasks = tasks.filter((t) => t.status === 'BACKLOG');
  const [isOpen, setIsOpen] = useState(backlogTasks.length > 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const updateTaskMutation = useUpdateTaskMutation();

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
      { id: taskId, updates: { status: 'BACKLOG' } },
      {
        onSuccess: () => {
          toast.success('Task moved to Backlog Space!');
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to move task to backlog');
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
        'rounded-2xl border transition-all duration-200 shadow-xs mb-4 overflow-hidden',
        backlogTasks.length > 0
          ? 'bg-amber-50/40 border-amber-200/80'
          : 'bg-slate-100/70 border-slate-200/80',
        isDragOver && 'ring-2 ring-amber-400 border-amber-400 bg-amber-100/50',
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-800 border border-amber-200/60 shadow-xs">
            <Archive className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 tracking-tight">Backlog Space</span>
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  backlogTasks.length > 0
                    ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                    : 'bg-slate-200 text-slate-600 border-slate-300',
                )}
              >
                {backlogTasks.length} {backlogTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">
              Holding area for unassigned workflow tasks and tasks from deleted columns.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {backlogTasks.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-lg font-medium border border-amber-200">
              <Sparkles className="w-3 h-3 text-amber-600" />
              Drag tasks into board columns to activate
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <span>{isOpen ? 'Collapse' : 'Expand'}</span>
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content area */}
      {isOpen && (
        <div className="px-4 pb-3.5 pt-1 border-t border-slate-200/50">
          {backlogTasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto pt-2 pr-1">
              {backlogTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-4 px-4 text-center border border-dashed border-slate-300/80 rounded-xl bg-white/40 my-1">
              <FolderArchive className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">
                Backlog space is empty. When a column is deleted, its tasks automatically park here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
