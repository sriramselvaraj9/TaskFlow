import { AlertOctagon, CheckCircle2, X } from 'lucide-react';
import type React from 'react';
import { useEffect } from 'react';
import { useTaskStore } from '@/store/useTaskStore';

export const TaskRestrictionModal: React.FC = () => {
  const { restrictionModalData, closeRestrictionModal } = useTaskStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRestrictionModal();
      }
    };

    if (restrictionModalData) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [restrictionModalData, closeRestrictionModal]);

  if (!restrictionModalData) return null;

  const {
    taskTitle,
    projectKey = 'TASK',
    remarks = 'Layout rule restricts updating status directly from TO DO to DONE. Please move the task to IN PROGRESS before marking it as DONE.',
  } = restrictionModalData;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={closeRestrictionModal}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-2xl z-10 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between">
          <div className="pr-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              This Item was not updated due to the given reason
            </h3>
          </div>
          <button
            type="button"
            onClick={closeRestrictionModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 space-y-4">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Item Box */}
            <div className="bg-[#fef9c3]/70 border border-yellow-200/80 rounded-2xl p-3 text-center">
              <span className="block text-xs font-semibold text-slate-700">Total Item</span>
              <span className="block text-xl font-bold text-slate-900 mt-0.5">1</span>
            </div>

            {/* Failed Item Box */}
            <div className="bg-[#fee2e2]/60 border border-rose-200/80 rounded-2xl p-3 text-center">
              <span className="block text-xs font-semibold text-slate-700">Failed Item</span>
              <span className="block text-xl font-bold text-rose-600 mt-0.5">1</span>
            </div>
          </div>

          {/* Details Table Container */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden shadow-2xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <div className="col-span-6 sm:col-span-5">Item Name</div>
              <div className="col-span-6 sm:col-span-7">Remarks</div>
            </div>

            {/* Table Row */}
            <div className="grid grid-cols-12 px-4 py-3.5 items-start text-xs gap-3">
              {/* Item Name */}
              <div className="col-span-6 sm:col-span-5 flex items-start gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-mono text-[10px] font-bold text-slate-500 block">
                    {projectKey}
                  </span>
                  <span className="font-semibold text-slate-900 break-words line-clamp-3">
                    {taskTitle}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div className="col-span-6 sm:col-span-7 text-slate-700 leading-relaxed break-words text-[11px] font-medium flex items-start gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{remarks}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-6 pt-5 flex items-center justify-start">
          <button
            type="button"
            onClick={closeRestrictionModal}
            className="px-5 py-2 bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
