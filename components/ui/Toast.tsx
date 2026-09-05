import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/useToastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl transition-all duration-200 animate-slide-in',
            t.type === 'success' && 'bg-slate-900 border-slate-700 text-white',
            t.type === 'error' && 'bg-rose-900 border-rose-700 text-white',
            t.type === 'info' && 'bg-slate-900 border-slate-700 text-white',
          )}
        >
          <div className="flex items-center gap-2.5">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
            <span className="text-xs font-semibold tracking-wide">{t.message}</span>
          </div>

          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
