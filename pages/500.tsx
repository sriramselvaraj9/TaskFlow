import { AlertTriangle, CheckSquare } from 'lucide-react';

export default function Custom500() {
  return (
    <div className="min-h-screen w-full bg-[#0f1422] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6 shadow-2xl relative z-10">
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
          <CheckSquare className="w-7 h-7" />
        </div>

        {/* 500 Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-bold">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>HTTP 500 INTERNAL SERVER ERROR</span>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Server Exception</h1>
          <p className="text-xs text-slate-400 font-normal leading-relaxed">
            An unexpected backend exception occurred. The error has been isolated and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
