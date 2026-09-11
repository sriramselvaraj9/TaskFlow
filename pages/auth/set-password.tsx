import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import type { User } from '@/types';

export default function SetPasswordPage() {
  const router = useRouter();
  const { token, email } = router.query;

  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [invitedUser, setInvitedUser] = useState<User | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!router.isReady) return;

    if (!token || !email) {
      setVerifying(false);
      setVerificationError('Missing invitation parameters. Please check your invitation link.');
      return;
    }

    const verifyInvite = async () => {
      try {
        setVerifying(true);
        setVerificationError(null);

        const res = await fetch(
          `/api/auth/verify-invite?token=${encodeURIComponent(token as string)}&email=${encodeURIComponent(email as string)}`,
        );
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setVerificationError(
            data.message || 'This invitation link is invalid or has expired. Please contact your workspace administrator.',
          );
        } else {
          setInvitedUser(data.user);
        }
      } catch (err: any) {
        setVerificationError('Failed to verify invitation link. Please check your network connection.');
      } finally {
        setVerifying(false);
      }
    };

    verifyInvite();
  }, [router.isReady, token, email]);

  const isPasswordValid = password.length >= 6;
  const isConfirmValid = confirmPassword.length >= 6 && confirmPassword === password;
  const isFormValid = isPasswordValid && isConfirmValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email as string).trim().toLowerCase(),
          token: (token as string).trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to activate account password');
      }

      setSubmitSuccess('Password created successfully! Redirecting to sign in...');
      toast.success('Password set successfully! Please sign in with your new password.');

      setTimeout(() => {
        router.push(
          `/auth/signin?email=${encodeURIComponent((email as string).trim().toLowerCase())}&activated=true`,
        );
      }, 1000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to set password');
      setSubmitting(false);
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
            <Sparkles className="w-3.5 h-3.5" />
            <span>Workspace Member Activation</span>
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Activate Your Workspace Account
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            You have been invited to join TaskFlow. Create your secure account password to access your team projects, boards, and workflows.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>End-to-End Encrypted Password Storage</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <KeyRound className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>One-Time Secure Invitation Token</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Instant Workspace & Project Access</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-500 relative z-10">
          TaskFlow Enterprise Security • Verified Member Registration
        </div>
      </div>

      {/* Right Column: Hosted Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl transition-all">
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2.5 lg:hidden mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-slate-900">Taskflow</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Set Your Password
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Complete your registration and activate your workspace profile.
              </p>
            </div>

            {/* Verifying Loader */}
            {verifying ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-600">Verifying invitation link...</p>
              </div>
            ) : verificationError ? (
              /* Invalid Token Banner */
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Invitation Link Invalid</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">{verificationError}</p>
                </div>
                <Link href="/auth/signin">
                  <Button variant="outline" size="md" className="w-full justify-center text-xs font-bold">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              /* Set Password Form */
              <>
                {/* Invited Member Profile Card */}
                {invitedUser && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {invitedUser.name ? invitedUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {invitedUser.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{invitedUser.email}</div>
                    </div>
                    {invitedUser.designation && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0">
                        {invitedUser.designation}
                      </span>
                    )}
                  </div>
                )}

                {/* Error / Success Alerts */}
                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{submitError}</span>
                  </div>
                )}

                {submitSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Create Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordTouched(true);
                        }}
                        onBlur={() => setPasswordTouched(true)}
                        placeholder="••••••••"
                        className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white shadow-xs transition-colors ${
                          passwordTouched
                            ? isPasswordValid
                              ? 'border-emerald-500 focus:border-emerald-500'
                              : 'border-rose-500 focus:border-rose-500'
                            : 'border-slate-200 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="h-4 flex items-center mt-0.5">
                      {passwordTouched && !isPasswordValid && (
                        <p className="text-[11px] text-rose-500 font-medium leading-none">
                          Password must be at least 6 characters long.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setConfirmPasswordTouched(true);
                        }}
                        onBlur={() => setConfirmPasswordTouched(true)}
                        placeholder="••••••••"
                        className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white shadow-xs transition-colors ${
                          confirmPasswordTouched
                            ? isConfirmValid
                              ? 'border-emerald-500 focus:border-emerald-500'
                              : 'border-rose-500 focus:border-rose-500'
                            : 'border-slate-200 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="h-4 flex items-center mt-0.5">
                      {confirmPasswordTouched && !isConfirmValid && (
                        <p className="text-[11px] text-rose-500 font-medium leading-none">
                          {confirmPassword.length < 6
                            ? 'Must be at least 6 characters.'
                            : 'Passwords do not match.'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    disabled={!isFormValid || submitting}
                    className="w-full justify-center py-3 text-xs font-bold bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    <span>Set Password & Proceed to Sign In</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
