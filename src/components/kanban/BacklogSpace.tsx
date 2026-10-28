import { Archive, ChevronDown, ChevronUp, FolderArchive } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BoardColumn, Task } from '@/types';
import { TaskCard } from './TaskCard';

interface BacklogSpaceProps {
  tasks: Task[];
  columns?: BoardColumn[];
}

export const BacklogSpace: React.FC<BacklogSpaceProps> = ({ tasks }) => {
  const backlogTasks = tasks.filter((t) => t.status === 'BACKLOG');
  const [isOpen, setIsOpen] = useState(backlogTasks.length > 0);

  useEffect(() => {
    if (backlogTasks.length > 0) {
      setIsOpen(true);
    }
  }, [backlogTasks.length]);

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200 shadow-xs mb-4 overflow-hidden',
        backlogTasks.length > 0
          ? 'bg-amber-50/40 border-amber-200/80'
          : 'bg-slate-100/70 border-slate-200/80',
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-800 border border-amber-200/60 shadow-xs">
            <Archive className="w-3.5 h-3.5" />
          </div>
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
        </div>

        <div className="flex items-center gap-2">
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
            <div className="flex items-center justify-center gap-2 py-3 px-4 text-center border border-dashed border-slate-300/80 rounded-xl bg-white/40 my-1">
              <FolderArchive className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">No tasks in backlog.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
