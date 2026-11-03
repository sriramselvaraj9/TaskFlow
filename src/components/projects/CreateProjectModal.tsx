import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateProjectMutation, useProjectsQuery } from '@/hooks/useProjects';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';
import { type ProjectFormData, projectSchema } from '@/lib/validators';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';

function generateUniqueKey(name: string, takenKeys: Set<string>): string {
  const clean = name.trim();
  if (!clean) return '';
  const words = clean.split(/\s+/).filter(Boolean);
  let baseKey = '';
  if (words.length >= 2) {
    baseKey = words
      .slice(0, 4)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  } else if (words.length === 1) {
    const match = words[0].match(/^([a-zA-Z]+)(\d+)?$/);
    if (match) {
      const letters = match[1].slice(0, 4).toUpperCase();
      const num = match[2] || '';
      baseKey = (letters.slice(0, 10 - num.length) + num).toUpperCase();
    } else {
      baseKey = words[0].slice(0, 4).toUpperCase();
    }
  }
  baseKey = baseKey.replace(/[^A-Z0-9]/g, '');
  if (baseKey.length < 2) {
    baseKey = `PRJ${Math.floor(100 + Math.random() * 900)}`;
  }

  let candidate = baseKey.slice(0, 10);
  let counter = 1;
  while (takenKeys.has(candidate)) {
    counter++;
    const suffix = String(counter);
    candidate = `${baseKey.slice(0, 10 - suffix.length)}${suffix}`;
  }
  return candidate;
}

export const CreateProjectModal: React.FC = () => {
  const { isCreateProjectOpen, setCreateProjectOpen } = useTaskStore();
  const { data: users = [] } = useUsersQuery();
  const { data: existingProjects = [] } = useProjectsQuery();
  const createProjectMutation = useCreateProjectMutation();

  const existingKeys = new Set(
    existingProjects.map((p) => (p.key || '').trim().toUpperCase()).filter(Boolean)
  );

  const existingNames = new Set(
    existingProjects.map((p) => (p.name || '').trim().toLowerCase()).filter(Boolean)
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
      memberIds: [],
    },
  });

  const memberIds = watch('memberIds') || [];
  const nameValue = watch('name') || '';

  useEffect(() => {
    if (isCreateProjectOpen) {
      reset();
      clearErrors();
    }
  }, [isCreateProjectOpen, reset, clearErrors]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('name', val, { shouldValidate: true });

    const trimmed = val.trim().toLowerCase();
    if (trimmed && existingNames.has(trimmed)) {
      setError('name', { message: `A project named "${val.trim()}" already exists.` });
    } else {
      clearErrors('name');
    }

    // Automatically generate unique project key in the background
    const autoKey = generateUniqueKey(val, existingKeys);
    setValue('key', autoKey);
  };

  const onSubmit = (data: ProjectFormData) => {
    const cleanName = data.name.trim();
    if (existingNames.has(cleanName.toLowerCase())) {
      setError('name', { message: `A project named "${cleanName}" already exists.` });
      return;
    }

    const finalKey = (data.key || generateUniqueKey(data.name, existingKeys)).toUpperCase();

    createProjectMutation.mutate(
      {
        ...data,
        name: cleanName,
        key: finalKey,
      },
      {
        onSuccess: (newProj) => {
          toast.success(`Project "${newProj.name}" created successfully!`);
          reset();
          clearErrors();
          setCreateProjectOpen(false);
        },
        onError: (err: any) => {
          const msg = err.message || 'Failed to create project';
          setError('name', { message: msg });
        },
      },
    );
  };

  const handleClose = () => {
    reset();
    clearErrors();
    setCreateProjectOpen(false);
  };

  return (
    <Modal
      isOpen={isCreateProjectOpen}
      onClose={handleClose}
      title="Create New Project Workspace"
      description="Initialize a product workspace and assign engineering members."
      maxWidth="md"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col justify-between min-h-[380px]"
      >
        <div className="space-y-4 flex-1">
          {/* Project Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Core API Infrastructure"
              value={nameValue}
              onChange={handleNameChange}
              className={cn(
                'w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none font-medium shadow-xs transition-colors',
                errors.name
                  ? 'border-rose-400 focus:border-rose-500 bg-rose-50/20'
                  : 'border-slate-200 focus:border-indigo-500'
              )}
            />
            {errors.name && (
              <p className="text-xs text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                <span>⚠️</span> {errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describe product goals and architecture scope (optional)..."
              {...register('description')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 leading-relaxed shadow-xs"
            />
            {errors.description && (
              <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Assign Team Member Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Assign Team Member
            </label>
            <select
              value={memberIds[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setValue('memberIds', val ? [val] : []);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold shadow-xs"
            >
              <option value="">None (Unassigned)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.designation || u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={createProjectMutation.isPending}
            disabled={createProjectMutation.isPending || Boolean(errors.name)}
          >
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};
