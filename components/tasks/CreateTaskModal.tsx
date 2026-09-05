import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronLeft, ChevronRight, Plus, Tag } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useColumnsQuery } from '@/hooks/useColumns';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useCreateTaskMutation } from '@/hooks/useTasks';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';
import {
  type CreateTaskFormData,
  createTaskFullSchema,
  taskSchemaStep1,
  taskSchemaStep2,
} from '@/lib/validators';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';

const SUGGESTED_TAGS = ['feature', 'bug', 'frontend', 'backend', 'design', 'qa', 'docs'];

export const CreateTaskModal: React.FC = () => {
  const { isCreateTaskOpen, setCreateTaskOpen, setCreateProjectOpen, selectedProjectId } =
    useTaskStore();
  const { data: projects = [] } = useProjectsQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: columns = [] } = useColumnsQuery();
  const createTaskMutation = useCreateTaskMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
    getValues,
    formState: { errors },
  } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFullSchema),
    shouldUnregister: false,
    defaultValues: {
      title: '',
      description: '',
      projectId:
        selectedProjectId && selectedProjectId !== 'ALL'
          ? selectedProjectId
          : projects[0]?.id || '',
      priority: 'MEDIUM',
      assigneeId: '',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tags: [],
      status: 'TODO',
    },
  });

  const tags = watch('tags') || [];
  const currentProjectId = watch('projectId');

  useEffect(() => {
    if (projects.length > 0) {
      const validProjectId =
        selectedProjectId &&
        selectedProjectId !== 'ALL' &&
        projects.some((p) => p.id === selectedProjectId)
          ? selectedProjectId
          : projects[0].id;

      if (
        !currentProjectId ||
        currentProjectId === 'ALL' ||
        !projects.some((p) => p.id === currentProjectId)
      ) {
        setValue('projectId', validProjectId);
      }
    }
  }, [projects, currentProjectId, selectedProjectId, setValue]);

  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd || tagInput;
    const trimmed = raw.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setValue('tags', [...tags, trimmed]);
      if (!tagToAdd) setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue(
      'tags',
      tags.filter((t) => t !== tagToRemove),
    );
  };

  const validateStep1 = () => {
    const title = getValues('title') || '';
    const description = getValues('description') || '';
    const projectId = getValues('projectId') || '';

    const result = taskSchemaStep1.safeParse({
      title,
      description,
      projectId,
    });
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CreateTaskFormData;
        if (field) {
          setError(field, { type: 'manual', message: issue.message });
        }
      });
      return false;
    }
    clearErrors(['title', 'description', 'projectId']);
    return true;
  };

  const validateStep2 = () => {
    const priority = getValues('priority') || 'MEDIUM';
    const assigneeId = getValues('assigneeId') || '';
    const dueDate = getValues('dueDate') || '';

    const result = taskSchemaStep2.safeParse({
      priority,
      assigneeId,
      dueDate,
    });
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CreateTaskFormData;
        if (field) {
          setError(field, { type: 'manual', message: issue.message });
        }
      });
      return false;
    }
    clearErrors(['priority', 'assigneeId', 'dueDate']);
    return true;
  };

  const handleNextStep = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    } else if (step === 3) {
      handleSubmit(onSubmit)(e);
    }
  };

  const onSubmit = (data: CreateTaskFormData) => {
    const finalTags = [...(data.tags || [])];
    const pendingTag = tagInput.trim().toLowerCase();
    if (pendingTag && !finalTags.includes(pendingTag)) {
      finalTags.push(pendingTag);
    }

    createTaskMutation.mutate(
      {
        ...data,
        tags: finalTags,
      },
      {
        onSuccess: () => {
          toast.success('Task created successfully!');
          reset({
            title: '',
            description: '',
            projectId: selectedProjectId || (projects[0]?.id ?? ''),
            priority: 'MEDIUM',
            assigneeId: '',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            tags: [],
            status: 'TODO',
          });
          setTagInput('');
          setStep(1);
          setCreateTaskOpen(false);
        },
      },
    );
  };

  const handleClose = () => {
    reset();
    setTagInput('');
    setStep(1);
    setCreateTaskOpen(false);
  };

  const handleStepClick = (targetStep: 1 | 2 | 3) => {
    if (targetStep === step) return;
    if (targetStep < step) {
      setStep(targetStep);
      return;
    }
    if (targetStep === 2) {
      if (validateStep1()) setStep(2);
    } else if (targetStep === 3) {
      if (validateStep1() && validateStep2()) setStep(3);
    }
  };

  return (
    <Modal
      isOpen={isCreateTaskOpen}
      onClose={handleClose}
      title="Create New Task"
      description="Configure task parameters, workload assignment, and priority."
      maxWidth="lg"
    >
      {/* Wizard Step Indicators */}
      <div className="flex items-center justify-between mb-6 px-2">
        {[
          { num: 1, label: 'Task Details' },
          { num: 2, label: 'Assignment' },
          { num: 3, label: 'Review' },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <button
              type="button"
              onClick={() => handleStepClick(s.num as 1 | 2 | 3)}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs',
                  step === s.num
                    ? 'bg-indigo-600 text-white border border-indigo-500'
                    : step > s.num
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 group-hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 group-hover:bg-slate-200',
                )}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span
                className={cn(
                  'text-xs font-semibold hidden sm:inline transition-colors',
                  step === s.num ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-700',
                )}
              >
                {s.label}
              </span>
            </button>
            {idx < 2 && <div className="w-8 sm:w-16 h-[1px] bg-slate-200 mx-2" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col justify-between h-[350px]">
        <div className="flex-1 overflow-y-auto pr-0.5">
          {/* STEP 1: Title, Description, Project */}
          <div className={cn('space-y-3.5 animate-fade-in', step !== 1 && 'hidden')}>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                placeholder="e.g., Implement OAuth2 refresh token rotation"
                {...register('title')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-xs font-medium"
              />
              {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Target Project *
              </label>
              {projects.length > 0 ? (
                <select
                  {...register('projectId')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold shadow-xs"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      [{proj.key}] {proj.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-amber-800 font-medium">
                    No projects available yet.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTaskOpen(false);
                      setCreateProjectOpen(true);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    + Create Project
                  </button>
                </div>
              )}
              {errors.projectId && (
                <p className="text-xs text-rose-600 mt-1">{errors.projectId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Description *
              </label>
              <textarea
                rows={3.5}
                placeholder="Provide comprehensive task details, AC, or links..."
                {...register('description')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 leading-relaxed shadow-xs"
              />
              {errors.description && (
                <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
              )}
            </div>
          </div>

          {/* STEP 2: Priority, Assignee, Due Date */}
          <div className={cn('space-y-3.5 animate-fade-in', step !== 2 && 'hidden')}>
            <input type="hidden" {...register('priority')} />
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Priority Level *
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => {
                  const currentPriority = watch('priority');
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue('priority', p)}
                      className={cn(
                        'p-2.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all text-center cursor-pointer',
                        currentPriority === p
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs ring-1 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              {errors.priority && (
                <p className="text-xs text-rose-600 mt-1">{errors.priority.message}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                {...register('assigneeId')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold shadow-xs"
              >
                <option value="">None (Unassigned)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              {errors.assigneeId && (
                <p className="text-xs text-rose-600 mt-1">{errors.assigneeId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Due Date *
              </label>
              <input
                type="date"
                {...register('dueDate')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-semibold shadow-xs"
              />
              {errors.dueDate && (
                <p className="text-xs text-rose-600 mt-1">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          {/* STEP 3: Review & Finalize (Summary Card + Status & Tags) */}
          <div className={cn('space-y-3.5 animate-fade-in', step !== 3 && 'hidden')}>
            {/* Review Summary Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Review Task Parameters
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {projects.find((p) => p.id === watch('projectId'))?.name || 'Project'}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {watch('title') || 'Untitled Task'}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-medium">
                  <span>
                    Priority:{' '}
                    <strong className="text-slate-800 font-bold">{watch('priority')}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Assignee:{' '}
                    <strong className="text-slate-800 font-bold">
                      {users.find((u) => u.id === watch('assigneeId'))?.name || 'Unassigned'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Due: <strong className="text-slate-800 font-bold">{watch('dueDate')}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Initial Column / Status
              </label>
              <select
                {...register('status')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold shadow-xs"
              >
                {columns.length > 0 ? (
                  columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </>
                )}
                <option value="BACKLOG">📦 Backlog Space</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Tags (Optional)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. frontend, auth, security..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono shadow-xs"
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => handleAddTag()}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Tag
                </Button>
              </div>

              {/* Quick Tag Suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Quick suggestions:
                </span>
                {SUGGESTED_TAGS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleAddTag(st)}
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded-md border transition-colors cursor-pointer',
                      tags.includes(st)
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
                    )}
                  >
                    +{st}
                  </button>
                ))}
              </div>

              {/* Active Tag Pills */}
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-xs bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-mono font-semibold shadow-xs"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-rose-600 ml-1 font-bold text-slate-400 cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {tags.length === 0 && (
                  <span className="text-xs text-slate-400 py-1">No tags added yet. (Optional)</span>
                )}
              </div>
              {errors.tags && <p className="text-xs text-rose-600 mt-1">{errors.tags.message}</p>}
            </div>
          </div>
        </div>

        {/* Footer Navigation Buttons (Fixed at bottom) */}
        <div className="flex items-center justify-between pt-3.5 border-t border-slate-200 mt-2 shrink-0">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button type="button" variant="primary" size="sm" onClick={handleNextStep}>
              Next Step
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={createTaskMutation.isPending}
            >
              Create Task
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};
