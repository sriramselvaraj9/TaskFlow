import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateProjectMutation } from '@/hooks/useProjects';
import { useUsersQuery } from '@/hooks/useUsers';
import { type ProjectFormData, projectSchema } from '@/lib/validators';
import { useTaskStore } from '@/store/useTaskStore';

export const CreateProjectModal: React.FC = () => {
  const { isCreateProjectOpen, setCreateProjectOpen } = useTaskStore();
  const { data: users = [] } = useUsersQuery();
  const createProjectMutation = useCreateProjectMutation();
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('name', val, { shouldValidate: true });

    // Auto-generate project key if not manually customized
    if (!isKeyManuallyEdited) {
      const words = val.trim().split(/\s+/).filter(Boolean);
      let autoKey = '';
      if (words.length >= 2) {
        autoKey = words
          .slice(0, 4)
          .map((w) => w[0])
          .join('')
          .toUpperCase();
      } else if (words.length === 1) {
        autoKey = words[0].slice(0, 4).toUpperCase();
      }
      autoKey = autoKey.replace(/[^A-Z0-9]/g, '');
      if (autoKey.length >= 2) {
        setValue('key', autoKey.slice(0, 5), { shouldValidate: true });
      }
    }
  };

  const onSubmit = (data: ProjectFormData) => {
    createProjectMutation.mutate(
      {
        ...data,
        key: data.key ? data.key.toUpperCase() : '',
      },
      {
        onSuccess: () => {
          reset();
          setIsKeyManuallyEdited(false);
          setCreateProjectOpen(false);
        },
      },
    );
  };

  const handleClose = () => {
    reset();
    setIsKeyManuallyEdited(false);
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
        className="flex flex-col justify-between min-h-[420px]"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium shadow-xs"
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
          </div>

          {/* Project Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Project Key
              </label>
              <span className="text-[10px] text-slate-400">e.g. API, WEB</span>
            </div>
            <input
              type="text"
              maxLength={5}
              placeholder="e.g. API"
              {...register('key')}
              onChange={(e) => {
                setIsKeyManuallyEdited(true);
                setValue('key', e.target.value.toUpperCase());
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 uppercase font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 font-bold shadow-xs tracking-wider"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Short badge prefix on tasks (e.g. <span className="font-mono font-bold">[API]</span>).
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Description *
            </label>
            <textarea
              rows={3}
              placeholder="Describe product goals and architecture scope..."
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
          >
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};
