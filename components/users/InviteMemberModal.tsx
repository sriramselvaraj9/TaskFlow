import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';

export const InviteMemberModal: React.FC = () => {
  const queryClient = useQueryClient();
  const { isInviteMemberOpen, setInviteMemberOpen } = useTaskStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [designationTouched, setDesignationTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Reset form whenever modal opens to prevent stale or autofilled values
  useEffect(() => {
    if (isInviteMemberOpen) {
      setName('');
      setEmail('');
      setDesignation('');
      setPassword('');
      setNameTouched(false);
      setEmailTouched(false);
      setDesignationTouched(false);
      setPasswordTouched(false);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [isInviteMemberOpen]);

  // Validations
  const nameRegex = /^[a-zA-Z0-9 ]{3,25}$/;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const isNameValid = nameRegex.test(name.trim());
  const isEmailValid = emailRegex.test(email.trim());
  const isDesignationValid = designation.trim().length >= 2;
  const isPasswordValid = password.length >= 6;

  const isFormValid = isNameValid && isEmailValid && isDesignationValid && isPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setEmailTouched(true);
    setDesignationTouched(true);
    setPasswordTouched(true);

    if (!isFormValid || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          designation: designation.trim(),
          password,
          role: 'MEMBER',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to provision team member');
      }

      setSuccessMessage(`Successfully added ${data.user.name} as ${data.user.designation}!`);
      toast.success(`Member "${data.user.name}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['users'] });

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to provision user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setName('');
    setEmail('');
    setDesignation('');
    setPassword('');
    setNameTouched(false);
    setEmailTouched(false);
    setDesignationTouched(false);
    setPasswordTouched(false);
    setInviteMemberOpen(false);
  };

  return (
    <Modal
      isOpen={isInviteMemberOpen}
      onClose={handleClose}
      title="Provision New Team Member"
      description="Invite a new corporate member to TaskFlow workspace."
    >
      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" autoComplete="off">
        {/* Hidden decoy fields to absorb browser credential autofill */}
        <div
          className="sr-only"
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden' }}
        >
          <input type="text" name="fake_username_trap" tabIndex={-1} autoComplete="off" />
          <input
            type="password"
            name="fake_password_trap"
            tabIndex={-1}
            autoComplete="new-password"
          />
        </div>

        {/* Full Name */}
        <div>
          <label
            htmlFor="new_member_fullname"
            className="text-xs font-bold text-slate-700 block mb-1"
          >
            Member Full Name *
          </label>
          <input
            type="text"
            id="new_member_fullname"
            name="new_member_fullname"
            autoComplete="off"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g. Kathryn Murphy"
            className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white shadow-xs transition-colors ${
              nameTouched
                ? isNameValid
                  ? 'border-emerald-500 focus:border-emerald-500'
                  : 'border-rose-500 focus:border-rose-500'
                : 'border-slate-200 focus:border-indigo-500'
            }`}
          />
          {nameTouched && !isNameValid && (
            <p className="text-xs text-rose-500 mt-1 font-medium">
              Must be 3-25 alphanumeric characters.
            </p>
          )}
        </div>

        {/* Corporate Email */}
        <div>
          <label
            htmlFor="new_member_corporate_email"
            className="text-xs font-bold text-slate-700 block mb-1"
          >
            Corporate Email Address *
          </label>
          <input
            type="email"
            id="new_member_corporate_email"
            name="new_member_corporate_email"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailTouched(true);
            }}
            onBlur={() => setEmailTouched(true)}
            placeholder="e.g. kathryn@taskflow.dev"
            className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white shadow-xs transition-colors ${
              emailTouched
                ? isEmailValid
                  ? 'border-emerald-500 focus:border-emerald-500'
                  : 'border-rose-500 focus:border-rose-500'
                : 'border-slate-200 focus:border-indigo-500'
            }`}
          />
          {emailTouched && !isEmailValid && (
            <p className="text-xs text-rose-500 mt-1 font-medium">
              Please enter a complete email address (e.g. name@domain.com).
            </p>
          )}
        </div>

        {/* Role / Designation */}
        <div>
          <label
            htmlFor="new_member_designation"
            className="text-xs font-bold text-slate-700 block mb-1"
          >
            Role / Designation *
          </label>
          <input
            type="text"
            id="new_member_designation"
            name="new_member_designation"
            autoComplete="off"
            required
            value={designation}
            onChange={(e) => {
              setDesignation(e.target.value);
              setDesignationTouched(true);
            }}
            onBlur={() => setDesignationTouched(true)}
            placeholder="e.g. Web Designer, Full Stack Developer, Marketing Coordinator"
            className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white shadow-xs transition-colors ${
              designationTouched
                ? isDesignationValid
                  ? 'border-emerald-500 focus:border-emerald-500'
                  : 'border-rose-500 focus:border-rose-500'
                : 'border-slate-200 focus:border-indigo-500'
            }`}
          />
          {designationTouched && !isDesignationValid && (
            <p className="text-xs text-rose-500 mt-1 font-medium">
              Designation must be at least 2 characters long.
            </p>
          )}
        </div>

        {/* Temporary Password */}
        <div>
          <label
            htmlFor="new_member_temp_password"
            className="text-xs font-bold text-slate-700 block mb-1"
          >
            Temporary Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="new_member_temp_password"
              name="new_member_temp_password"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordTouched(true);
              }}
              onBlur={() => setPasswordTouched(true)}
              placeholder="Enter temporary password (min 6 characters)"
              className={`w-full bg-slate-50 border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:bg-white shadow-xs transition-colors ${
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordTouched && !isPasswordValid && (
            <p className="text-xs text-rose-500 mt-1 font-medium">
              Password must be at least 6 characters long.
            </p>
          )}
        </div>

        {/* Actions (Single primary button, close via top-right X) */}
        <div className="pt-3 border-t border-slate-200">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isLoading}
            disabled={!isFormValid || isLoading}
            className="w-full justify-center py-2.5 text-xs font-bold shadow-sm"
          >
            Provision Team Member
          </Button>
        </div>
      </form>
    </Modal>
  );
};
