import { AlertTriangle, X } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl z-10 animate-scale-in max-h-[90vh] flex flex-col justify-between overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 leading-snug break-words [overflow-wrap:anywhere]">
              {title}
            </h3>
            <div className="text-xs text-slate-500 font-normal leading-relaxed break-words [overflow-wrap:anywhere] max-h-40 overflow-y-auto pr-1">
              {description}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs font-semibold"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={isLoading}
            onClick={onConfirm}
            className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
