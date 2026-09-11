import { Briefcase, CheckCircle2, Mail, Send, ShieldCheck, User as UserIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateUserMutation } from '@/hooks/useUsers';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';

export const InviteMemberModal: React.FC = () => {
  const { isInviteMemberOpen, setInviteMemberOpen } = useTaskStore();
  const createUserMutation = useCreateUserMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');

  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Reset form whenever modal opens to prevent stale or autofilled values
  useEffect(() => {
    if (isInviteMemberOpen) {
      setName('');
      setEmail('');
      setDesignation('');
      setNameTouched(false);
      setEmailTouched(false);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [isInviteMemberOpen]);

  // Validations
  const nameRegex = /^[a-zA-Z0-9 ]{2,40}$/;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const isNameValid = nameRegex.test(name.trim());
  const isEmailValid = emailRegex.test(email.trim());

  const isFormValid = isNameValid && isEmailValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setEmailTouched(true);

    if (!isFormValid || createUserMutation.isPending) return;

    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await createUserMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'MEMBER',
        designation: designation.trim() || undefined,
      });

      const invitedUser = result.user;

      setSuccessMessage(`Invitation email sent successfully to ${invitedUser.email}!`);
      toast.success(`Invitation email sent to "${invitedUser.name}" (${invitedUser.email})!`);

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send invitation');
    }
  };

  const handleClose = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setName('');
    setEmail('');
    setDesignation('');
    setNameTouched(false);
    setEmailTouched(false);
    setInviteMemberOpen(false);
  };

  return (
    <Modal
      isOpen={isInviteMemberOpen}
      onClose={handleClose}
      title="Invite New Team Member"
      description="Send an email invitation so the member can set their password and join your workspace."
      maxWidth="md"
    >
      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <p className="text-[11px] text-emerald-700">
            The member will receive an email with instructions to set their password.
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" autoComplete="off">
        {/* Full Name */}
        <div>
          <label
            htmlFor="new_member_fullname"
            className="text-xs font-bold text-slate-700 block mb-1"
          >
            Member Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
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
              className={`w-full bg-slate-50 border rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white shadow-xs transition-colors ${
                nameTouched
                  ? isNameValid
                    ? 'border-emerald-500 focus:border-emerald-500'
                    : 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-200 focus:border-indigo-500'
              }`}
            />
            <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <div className="h-4 flex items-center mt-0.5">
            {nameTouched && !isNameValid && (
              <p className="text-[11px] text-rose-500 font-medium leading-none">
                Please enter a valid name (2-40 characters).
              </p>
            )}
          </div>
        </div>

        {/* Corporate Email */}
        <div>
          <label
            htmlFor="new_member_corporate_email"
            className="text-xs font-bold text-slate-700 block mb-1"
          >
            Corporate Email Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="email"
              id="new_member_corporate_email"
              name="new_member_corporate_email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTouched(true);
              }}
              onBlur={() => setEmailTouched(true)}
              placeholder="e.g. kathryn@taskflow.dev"
              className={`w-full bg-slate-50 border rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white shadow-xs transition-colors ${
                emailTouched
                  ? isEmailValid
                    ? 'border-emerald-500 focus:border-emerald-500'
                    : 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-200 focus:border-indigo-500'
              }`}
            />
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <div className="h-4 flex items-center mt-0.5">
            {emailTouched && !isEmailValid && (
              <p className="text-[11px] text-rose-500 font-medium leading-none">
                Please enter a complete email address (e.g. name@domain.com).
              </p>
            )}
          </div>
        </div>

        {/* Corporate Designation (Optional) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="new_member_designation" className="text-xs font-bold text-slate-700">
              Designation
            </label>
            <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
              Optional
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              id="new_member_designation"
              name="new_member_designation"
              autoComplete="off"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Full Stack Engineer, UI Designer"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 shadow-xs transition-colors"
            />
            <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Security Info Card */}
        <div className="p-3 bg-indigo-50/70 border border-indigo-100/80 rounded-xl flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-indigo-900/80 leading-relaxed font-medium">
            An email with a secure registration link will be sent to the member so they can set their own password and activate their account.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-slate-100">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={createUserMutation.isPending}
            disabled={!isFormValid || createUserMutation.isPending}
            className="w-full justify-center py-2.5 text-xs font-bold shadow-sm cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 mr-2" />
            Send Workspace Invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
};

