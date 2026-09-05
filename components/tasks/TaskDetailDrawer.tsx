import { CheckCircle2, Save, Trash2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useColumnsQuery } from '@/hooks/useColumns';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useDeleteTaskMutation, useTaskQuery, useUpdateTaskMutation } from '@/hooks/useTasks';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn, isOverdue } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { Task, TaskPriority, TaskStatus } from '@/types';

export const TaskDetailDrawer: React.FC = () => {
  const { data: session } = useSession();
  const { selectedTaskId, setSelectedTaskId } = useTaskStore();
  const { data: task, isLoading } = useTaskQuery(selectedTaskId);
  const { data: projects = [] } = useProjectsQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: columns = [] } = useColumnsQuery();

  const updateTaskMutation = useUpdateTaskMutation();
  const deleteTaskMutation = useDeleteTaskMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isAssignedToUser = Boolean(session?.user?.id && task?.assigneeId === session.user.id);
  const canModifyStatus = isAdmin || isAssignedToUser;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId || '');
      setDueDate(task.dueDate.split('T')[0]);
      setSavedSuccess(false);
    }
  }, [task]);

  if (!selectedTaskId) return null;

  const project = projects.find((p) => p.id === task?.projectId);
  const overdue = task ? isOverdue(dueDate || task.dueDate, status || task.status) : false;

  const isDirty = Boolean(
    task &&
      (title.trim() !== task.title ||
        description !== task.description ||
        status !== task.status ||
        priority !== task.priority ||
        assigneeId !== task.assigneeId ||
        dueDate !== task.dueDate.split('T')[0]),
  );

  const handleConfirmChanges = () => {
    if (!task) return;
    const updates: Partial<Task> = isAdmin
      ? {
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          assigneeId: assigneeId || '',
          dueDate: dueDate
            ? dueDate.includes('T')
              ? dueDate
              : `${dueDate}T00:00:00.000Z`
            : task.dueDate,
        }
      : {
          status,
        };

    updateTaskMutation.mutate(
      {
        id: task.id,
        updates,
      },
      {
        onSuccess: (updatedTask) => {
          setSavedSuccess(true);
          toast.success('Task updated successfully!');
          if (updatedTask) {
            setTitle(updatedTask.title);
            setDescription(updatedTask.description);
            setStatus(updatedTask.status);
            setPriority(updatedTask.priority);
            setAssigneeId(updatedTask.assigneeId || '');
            setDueDate(updatedTask.dueDate ? updatedTask.dueDate.split('T')[0] : '');
          }
          setTimeout(() => setSavedSuccess(false), 2500);
        },
      },
    );
  };

  const handleResetForm = () => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId || '');
      setDueDate(task.dueDate.split('T')[0]);
      setSavedSuccess(false);
    }
  };

  const confirmDelete = () => {
    if (!isAdmin || !task) return;
    deleteTaskMutation.mutate(task.id, {
      onSuccess: () => {
        setIsConfirmOpen(false);
        setSelectedTaskId(null);
        toast.success('Task deleted successfully!');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => setSelectedTaskId(null)}
      />

      {/* Drawer Content */}
      <div className="relative w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl z-10 animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {project?.key || 'TASK'}
            </span>
            <span className="text-xs text-slate-600 font-semibold">Task Inspector</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                onClick={() => setIsConfirmOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setSelectedTaskId(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading || !task ? (
          <div className="p-8 space-y-4 animate-pulse flex-1">
            <div className="h-6 bg-slate-100 rounded-lg w-3/4" />
            <div className="h-20 bg-slate-50 rounded-xl" />
            <div className="h-40 bg-slate-50 rounded-xl" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Saved Success Notification */}
            {savedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Task changes saved & confirmed successfully!</span>
              </div>
            )}

            {/* Title Section */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Task Title
              </label>
              {isAdmin ? (
                <textarea
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 shadow-xs resize-none break-words [overflow-wrap:anywhere] leading-snug"
                />
              ) : (
                <h2 className="text-sm sm:text-base font-bold text-slate-900 py-1 leading-snug break-words [overflow-wrap:anywhere]">
                  {task.title}
                </h2>
              )}
            </div>

            {/* Quick Properties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-card">
              {/* Status */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  disabled={!canModifyStatus}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className={cn(
                    'w-full border rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none shadow-xs',
                    canModifyStatus
                      ? 'bg-white border-slate-200 focus:border-indigo-500 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed',
                  )}
                >
                  <option value="BACKLOG">📦 Backlog Space</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  disabled={!isAdmin}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className={cn(
                    'w-full border rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none shadow-xs',
                    isAdmin
                      ? 'bg-white border-slate-200 focus:border-indigo-500 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed',
                  )}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Assignee
                </label>
                <select
                  value={assigneeId}
                  disabled={!isAdmin}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className={cn(
                    'w-full border rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none shadow-xs',
                    isAdmin
                      ? 'bg-white border-slate-200 focus:border-indigo-500 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed',
                  )}
                >
                  <option value="">None (Unassigned)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Due Date {overdue && <span className="text-rose-600 font-bold">(Overdue)</span>}
                </label>
                <input
                  type="date"
                  disabled={!isAdmin}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={cn(
                    'w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none shadow-xs',
                    isAdmin
                      ? 'bg-white cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                    overdue
                      ? 'border-rose-300 text-rose-600'
                      : 'border-slate-200 focus:border-indigo-500',
                  )}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Task Description
              </label>
              <textarea
                rows={5}
                readOnly={!isAdmin}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description..."
                className={cn(
                  'w-full border rounded-2xl p-3.5 text-xs text-slate-900 leading-relaxed shadow-xs break-words [overflow-wrap:anywhere]',
                  isAdmin
                    ? 'bg-slate-50 border-slate-200 focus:outline-none focus:bg-white focus:border-indigo-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 cursor-default',
                )}
              />
            </div>
          </div>
        )}

        {/* Footer with Confirm Changes Action Button */}
        {task && (canModifyStatus || isAdmin) && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500 font-medium">
              {isDirty ? (
                <span className="text-amber-600 font-bold">Unsaved edits pending...</span>
              ) : (
                <span className="text-slate-400">All changes saved</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDirty && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!isDirty}
                loading={updateTaskMutation.isPending}
                onClick={handleConfirmChanges}
                className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Confirm Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete Task"
        description={`Are you sure you want to delete "${task?.title}"? This action cannot be undone.`}
        confirmText="Delete Task"
        isLoading={deleteTaskMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
