import {
  Briefcase,
  Calendar,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useDeleteUserMutation, useUsersQuery } from '@/hooks/useUsers';
import { formatDate, getUserInitials } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { User } from '@/types';

export const TeamMembersView: React.FC = () => {
  const { data: session } = useSession();
  const { setInviteMemberOpen } = useTaskStore();
  const { data: users = [], isLoading } = useUsersQuery();
  const deleteUserMutation = useDeleteUserMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.designation?.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await deleteUserMutation.mutateAsync(userToDelete.id);
      toast.success(`Member "${userToDelete.name}" removed successfully.`);
      setUserToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Team Members</h1>
              <p className="text-xs text-slate-500 font-medium">
                Workspace directory of all team members and their corporate designations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 shadow-xs font-medium"
            />
          </div>

          {/* Add Member Button (Admin Only) */}
          {isAdmin && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setInviteMemberOpen(true)}
              className="whitespace-nowrap shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75">
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Name Of The Member
                </th>
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Designation
                </th>
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Joining Date
                </th>
                {isAdmin && (
                  <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                [1, 2, 3].map((n) => (
                  <tr key={n} className="animate-pulse">
                    <td className="py-4 px-6">
                      <div className="h-4 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-4 bg-slate-100 rounded w-48" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-4 bg-slate-100 rounded w-28" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-6 text-right">
                        <div className="h-6 w-14 bg-slate-100 rounded ml-auto" />
                      </td>
                    )}
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="py-12 text-center text-slate-400">
                    <UserIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No team members found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try adjusting your search criteria.'
                        : 'Invite team members to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrentUser = session?.user?.id === user.id;
                  const designationText =
                    user.designation ||
                    (user.role === 'ADMIN' ? 'Lead Administrator' : 'Software Engineer');

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name + Avatar + Role Badge */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                            {getUserInitials(user.name)}
                          </div>
                          <div className="min-w-0 max-w-[180px] sm:max-w-[220px]">
                            <div
                              className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
                              title={user.name}
                            >
                              {user.name}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                                user.role === 'ADMIN'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {user.role === 'ADMIN' && <ShieldCheck className="w-2.5 h-2.5" />}
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        <div
                          className="flex items-center gap-1.5 min-w-0 max-w-[200px] sm:max-w-[260px] md:max-w-[320px]"
                          title={user.email}
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </td>

                      {/* Designation */}
                      <td className="py-4 px-6">
                        <div
                          className="flex items-center gap-1.5 text-slate-800 font-semibold min-w-0 max-w-[180px] sm:max-w-[240px] md:max-w-[300px]"
                          title={designationText}
                        >
                          <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{designationText}</span>
                        </div>
                      </td>

                      {/* Joining Date */}
                      <td className="py-4 px-6 whitespace-nowrap text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {user.createdAt ? formatDate(user.createdAt) : 'Recently Joined'}
                          </span>
                        </div>
                      </td>

                      {/* Actions (Admin Only) */}
                      {isAdmin && (
                        <td className="py-4 px-6 whitespace-nowrap text-right">
                          {isCurrentUser ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              Current User
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50/60 hover:bg-rose-100/80 border border-rose-200/60 rounded-lg transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title={`Delete ${user.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        title="Delete Team Member"
        description={`Are you sure you want to remove "${userToDelete?.name}" (${userToDelete?.email})? This will unassign any active tasks and remove them from all projects. This action cannot be undone.`}
        confirmText="Delete Member"
        cancelText="Cancel"
        isLoading={deleteUserMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!deleteUserMutation.isPending) {
            setUserToDelete(null);
          }
        }}
      />
    </div>
  );
};
