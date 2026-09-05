import { Plus, RotateCcw, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  useColumnsQuery,
  useDeleteColumnMutation,
  useReorderColumnsMutation,
} from '@/hooks/useColumns';
import { useTaskStore } from '@/store/useTaskStore';
import type { Task } from '@/types';
import { AddColumnModal } from './AddColumnModal';
import { BacklogSpace } from './BacklogSpace';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  tasks: Task[];
  isLoading?: boolean;
}

interface ColumnToDelete {
  id: string;
  title: string;
  taskCount: number;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, isLoading }) => {
  const { data: session } = useSession();
  const { searchQuery, setSearchQuery } = useTaskStore();
  const { data: columns = [], isLoading: isColumnsLoading } = useColumnsQuery();
  const deleteColumnMutation = useDeleteColumnMutation();
  const reorderColumnsMutation = useReorderColumnsMutation();

  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<ColumnToDelete | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';

  const handleDeleteColumnClick = (id: string, title: string, count: number) => {
    setColumnToDelete({ id, title, taskCount: count });
  };

  const handleConfirmDeleteColumn = () => {
    if (!columnToDelete) return;
    deleteColumnMutation.mutate(columnToDelete.id, {
      onSuccess: () => {
        setColumnToDelete(null);
      },
    });
  };

  const handleMoveColumn = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const newColumnIds = columns.map((c) => c.id);
    const temp = newColumnIds[index];
    newColumnIds[index] = newColumnIds[targetIndex];
    newColumnIds[targetIndex] = temp;

    reorderColumnsMutation.mutate(newColumnIds);
  };

  if (isLoading || isColumnsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-[500px] rounded-2xl bg-surface-base/40 border border-white/8 p-4 animate-pulse space-y-3"
          >
            <div className="h-5 w-28 bg-white/10 rounded-lg mb-4" />
            <div className="h-28 bg-surface-elevated rounded-xl" />
            <div className="h-28 bg-surface-elevated rounded-xl" />
            <div className="h-28 bg-surface-elevated rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6 pt-1">
      {/* Search No Results alert */}
      {searchQuery && tasks.length === 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs text-slate-700 shadow-xs">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              No tasks found matching <strong>&ldquo;{searchQuery}&rdquo;</strong>.
            </span>
          </div>
          <button
            onClick={() => setSearchQuery('')}
            className="flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Search</span>
          </button>
        </div>
      )}

      {/* Active Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto select-none min-h-[calc(100vh-300px)] pb-4 items-start">
        {columns.map((col, index) => {
          const columnTasks = tasks.filter((task) => task.status === col.id);
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={columnTasks}
              accentColor={col.accentColor}
              dotColor={col.dotColor}
              onDeleteColumn={handleDeleteColumnClick}
              onMoveLeft={() => handleMoveColumn(index, 'left')}
              onMoveRight={() => handleMoveColumn(index, 'right')}
              canMoveLeft={index > 0}
              canMoveRight={index < columns.length - 1}
            />
          );
        })}

        {/* Add Column Placeholder Card (Admin Only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddColumnOpen(true)}
            className="flex flex-col items-center justify-center min-w-[200px] h-40 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-100/50 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 transition-all cursor-pointer p-4 group shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 group-hover:border-indigo-300 group-hover:bg-indigo-100/60 flex items-center justify-center transition-all shadow-2xs mb-2">
              <Plus className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <span className="text-xs font-bold">Add Column</span>
            <span className="text-[10px] text-slate-400 group-hover:text-indigo-500/80 mt-0.5">
              New workflow state
            </span>
          </button>
        )}
      </div>

      {/* Dedicated Backlog Space (Collapsible Holding & Migration area for deleted columns) */}
      <BacklogSpace tasks={tasks} columns={columns} />

      {/* Add Column Modal */}
      <AddColumnModal isOpen={isAddColumnOpen} onClose={() => setIsAddColumnOpen(false)} />

      {/* Delete Column Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(columnToDelete)}
        title="Delete Board Column"
        description={`Are you sure you want to delete the "${columnToDelete?.title}" column? ${
          columnToDelete && columnToDelete.taskCount > 0
            ? `All ${columnToDelete.taskCount} task(s) currently in this column will be safely moved to the Backlog space.`
            : 'This column has no tasks.'
        }`}
        confirmText="Delete Column"
        isLoading={deleteColumnMutation.isPending}
        onConfirm={handleConfirmDeleteColumn}
        onClose={() => setColumnToDelete(null)}
      />
    </div>
  );
};
