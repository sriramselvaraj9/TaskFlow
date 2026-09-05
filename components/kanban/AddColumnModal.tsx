import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import type React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateColumnMutation } from '@/hooks/useColumns';
import { type CreateColumnFormData, createColumnSchema } from '@/lib/validators';

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddColumnModal: React.FC<AddColumnModalProps> = ({ isOpen, onClose }) => {
  const createColumnMutation = useCreateColumnMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateColumnFormData>({
    resolver: zodResolver(createColumnSchema),
    defaultValues: {
      title: '',
      dotColor: 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]',
      accentColor: 'border-slate-900',
    },
  });

  const onSubmit = (data: CreateColumnFormData) => {
    createColumnMutation.mutate(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Board Column"
      description="Create a new workflow stage for your taskboard."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Column Name *
          </label>
          <input
            type="text"
            placeholder="e.g. QA & Testing, Blocked, Ready for Deploy..."
            {...register('title')}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-xs font-semibold"
            autoFocus
          />
          {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mt-6">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={createColumnMutation.isPending}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Column
          </Button>
        </div>
      </form>
    </Modal>
  );
};
