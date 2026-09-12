import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  Send,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateUserMutation } from '@/hooks/useUsers';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { User } from '@/types';

export const InviteMemberModal: React.FC = () => {
  const { isInviteMemberOpen, setInviteMemberOpen } = useTaskStore();
  const createUserMutation = useCreateUserMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');

  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [emailSentStatus, setEmailSentStatus] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form whenever modal opens to prevent stale or autofilled values
  useEffect(() => {
    if (isInviteMemberOpen) {
      setName('');
      setEmail('');
      setDesignation('');
      setNameTouched(false);
      setEmailTouched(false);
      setErrorMessage('');
      setCreatedUser(null);
      setInviteLink('');
      setEmailSentStatus(null);
      setCopied(false);
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

    try {
      const result = await createUserMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'MEMBER',
        designation: designation.trim() || undefined,
      });

      const invitedUser = result.user;
      setCreatedUser(invitedUser);
      setInviteLink(result.inviteUrl || '');
      setEmailSentStatus(Boolean(result.emailSent));

      if (result.emailSent) {
        toast.success(`Invitation email sent to "${invitedUser.name}" (${invitedUser.email})!`);
      } else {
        toast.warning(
          `Member added! Email could not be sent automatically. Please copy the invitation link.`,
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to provision team member');
    }
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Invitation link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setErrorMessage('');
    setName('');
    setEmail('');
    setDesignation('');
    setNameTouched(false);
    setEmailTouched(false);
    setCreatedUser(null);
    setInviteLink('');
    setEmailSentStatus(null);
    setCopied(false);
    setInviteMemberOpen(false);
  };

  return (
    <Modal
      isOpen={isInviteMemberOpen}
      onClose={handleClose}
      title={createdUser ? 'Member Provisioned Successfully' : 'Invite New Team Member'}
      description={
        createdUser
          ? 'The new workspace member profile is ready.'
          : 'Send an email invitation so the member can set their password and join your workspace.'
      }
      maxWidth="md"
    >
      {/* If member was just created, show success state with link copier */}
      {createdUser ? (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Status Banner */}
          {emailSentStatus ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Invitation Email Sent Successfully!</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                An invitation email was delivered to <strong>{createdUser.email}</strong>. They can
                click the link to set their password.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-2 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Member Added — Email Delivery Notice</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                The account was created, but the automatic email could not be sent (Brevo API key or SMTP
                not configured on the server). <strong>Please copy and share the invitation link below directly with the member:</strong>
              </p>
            </div>
          )}

          {/* Member Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                {createdUser.name ? createdUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{createdUser.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{createdUser.email}</div>
              </div>
            </div>
            {createdUser.designation && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0">
                {createdUser.designation}
              </span>
            )}
          </div>

          {/* Invitation Link Box */}
          {inviteLink && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Direct Set-Password Link (Valid for 7 days)
              </label>
              <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 rounded-xl p-2 pl-3">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="bg-transparent text-xs text-slate-800 font-mono flex-1 outline-none truncate select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={copied ? 'secondary' : 'primary'}
                  onClick={handleCopyLink}
                  className="shrink-0 text-xs font-bold cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Close / Done Action */}
          <div className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClose}
              className="text-xs font-bold cursor-pointer"
            >
              Done & Close
            </Button>
            {inviteLink && (
              <a
                href={inviteLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 rounded-xl transition-colors"
              >
                <span>Open Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ) : (
        /* Form view */
        <>
          {/* Feedback Error Alert */}
          {errorMessage && (
            <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {errorMessage}
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
        </>
      )}
    </Modal>
  );
};
