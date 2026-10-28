import { CheckSquare, FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function Custom404() {
  return (
    <div className="min-h-screen w-full bg-[#0f1422] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6 shadow-2xl relative z-10">
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#4f46e5] flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <CheckSquare className="w-7 h-7" />
        </div>

        {/* 404 Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold">
          <FileQuestion className="w-3.5 h-3.5" />
          <span>HTTP 404 ERROR &bull; PAGE NOT FOUND</span>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">404 - Page Not Found</h1>
          <p className="text-sm text-slate-300 font-medium leading-relaxed">
            The workspace route or page you are looking for does not exist, has been moved, or the link may contain a typo.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Please check the URL for mistakes or navigate back to the main application below.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 active:scale-[0.98] cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
