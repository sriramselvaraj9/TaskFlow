import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const res = await signIn('credentials', {
      redirect: false,
      email: email.trim().toLowerCase(),
      password,
      callbackUrl: '/',
    });

    setIsLoading(false);

    if (res?.error) {
      setError(res.error);
    } else if (res?.ok) {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] flex">
      {/* Left Column: Branding / Value Prop */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f1422] border-r border-white/8 p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle background glow elements */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <CheckSquare className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Taskflow</span>
        </div>

        {/* Center Marketing Copy */}
        <div className="space-y-6 max-w-lg relative z-10 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>High-Velocity Engineering Workspace</span>
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Corporate Team Portal
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            Secure internal task management portal. Access is restricted to authorized company team
            members.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Role-Based Access Control (RBAC)</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Admin User Provisioning System</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <span>Live Recharts Analytics & Workload Insights</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-500 relative z-10">
          Enterprise Portal • Admin Provisioned Accounts Only
        </div>
      </div>

      {/* Right Column: Hosted Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl transition-all">
          <div className="space-y-7 animate-fade-in">
            {/* Form Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 lg:hidden mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-slate-900">Taskflow</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign in to Taskflow
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Enter your corporate credentials to access your workspace.
              </p>
            </div>

            {/* Error / Success Feedback Banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Corporate Email Address
                </label>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@taskflow.dev"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-xs"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full justify-center py-3 text-xs font-bold bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Sign In to Portal
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
