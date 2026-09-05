import { AlertCircle, Calendar, Check, FolderKanban, Save, Trash2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  useDeleteProjectMutation,
  useProjectQuery,
  useUpdateProjectMutation,
} from '@/hooks/useProjects';
import { useTasksQuery } from '@/hooks/useTasks';
import { useUsersQuery } from '@/hooks/useUsers';
import { cn, formatDate, getUserInitials, isOverdue } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { toast } from '@/store/useToastStore';
import type { ProjectStatus } from '@/types';

export const ProjectDetailDrawer: React.FC = () => {
  const { data: session } = useSession();
  const { selectedProjectIdForDetail, setSelectedProjectIdForDetail, setSelectedTaskId } =
    useTaskStore();

  const { data: project, isLoading: isProjectLoading } = useProjectQuery(
    selectedProjectIdForDetail || undefined,
  );
  const { data: users = [] } = useUsersQuery();
  const { data: projectTasks = [], isLoading: isTasksLoading } = useTasksQuery(
    selectedProjectIdForDetail ? { projectId: selectedProjectIdForDetail } : undefined,
  );

  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'members'>('overview');

  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setStatus(project.status);
      setSelectedMemberIds(project.memberIds || []);
    }
  }, [project]);

  if (!selectedProjectIdForDetail) return null;

  const isDirty = Boolean(
    project &&
      (name.trim() !== project.name ||
        description.trim() !== (project.description || '') ||
        status !== project.status ||
        JSON.stringify(selectedMemberIds.sort()) !== JSON.stringify([...project.memberIds].sort())),
  );

  const owner = users.find((u) => u.id === project?.ownerId);
  const assignedMembers = users.filter((u) => selectedMemberIds.includes(u.id));

  // Task Statistics
  const totalTasks = projectTasks.length;
  const doneTasks = projectTasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = projectTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const inReviewTasks = projectTasks.filter((t) => t.status === 'IN_REVIEW').length;
  const todoTasks = projectTasks.filter((t) => t.status === 'TODO').length;
  const overdueTasks = projectTasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleToggleMember = (userId: string) => {
    if (!isAdmin) return;
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSaveChanges = () => {
    if (!project || !isAdmin) return;
    if (name.trim().length < 3) {
      toast.error('Project name must be at least 3 characters');
      return;
    }

    updateProjectMutation.mutate(
      {
        id: project.id,
        updates: {
          name: name.trim(),
          description: description.trim(),
          status,
          memberIds: selectedMemberIds,
        },
      },
      {
        onSuccess: () => {
          toast.success('Project details updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to update project');
        },
      },
    );
  };

  const handleResetChanges = () => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setStatus(project.status);
      setSelectedMemberIds(project.memberIds || []);
    }
  };

  const handleDeleteProject = () => {
    if (!project || !isAdmin) return;
    deleteProjectMutation.mutate(project.id, {
      onSuccess: () => {
        setIsConfirmDeleteOpen(false);
        setSelectedProjectIdForDetail(null);
        toast.success(`Project "${project.name}" deleted successfully`);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to delete project');
      },
    });
  };

  const filteredWorkspaceUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      Boolean(u.designation?.toLowerCase().includes(memberSearchQuery.toLowerCase())),
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => setSelectedProjectIdForDetail(null)}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl z-10 animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {project?.key || 'PRJ'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 line-clamp-1">
                  {project?.name || 'Project Details'}
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Project Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Delete Project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setSelectedProjectIdForDetail(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'py-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer',
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={cn(
              'py-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5',
              activeTab === 'tasks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <span>Tasks</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-semibold">
              {projectTasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'py-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5',
              activeTab === 'members'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <span>Team Members</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-semibold">
              {selectedMemberIds.length}
            </span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isProjectLoading ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-6 w-48 bg-slate-100 rounded-lg" />
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-32 bg-slate-100 rounded-xl" />
            </div>
          ) : !project ? (
            <div className="py-16 text-center text-slate-400 text-sm font-medium">
              Project could not be found or has been deleted.
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Progress Card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">Project Completion</span>
                      <span className="text-xs font-bold text-indigo-600">{completionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-4">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>

                    {/* Task Breakdown Chips */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-white rounded-xl p-2 border border-slate-200/60 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          TODO
                        </span>
                        <span className="text-sm font-bold text-slate-800">{todoTasks}</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-slate-200/60 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          In Progress
                        </span>
                        <span className="text-sm font-bold text-blue-600">{inProgressTasks}</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-slate-200/60 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          In Review
                        </span>
                        <span className="text-sm font-bold text-purple-600">{inReviewTasks}</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-slate-200/60 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Done
                        </span>
                        <span className="text-sm font-bold text-emerald-600">{doneTasks}</span>
                      </div>
                    </div>

                    {overdueTasks > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 font-semibold bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {overdueTasks} task{overdueTasks > 1 ? 's' : ''} overdue in this project
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Project Name & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Project Name
                      </label>
                      {isAdmin ? (
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                        />
                      ) : (
                        <div className="text-sm font-bold text-slate-900 py-1 break-words [overflow-wrap:anywhere]">
                          {project.name}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
                      {isAdmin ? (
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer transition-colors"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                      ) : (
                        <span
                          className={cn(
                            'inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border mt-0.5',
                            project.status === 'ACTIVE'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : project.status === 'COMPLETED'
                                ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                                : 'text-slate-600 bg-slate-100 border-slate-200',
                          )}
                        >
                          {project.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Description
                    </label>
                    {isAdmin ? (
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide details about the project goals and objectives..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors resize-none leading-relaxed break-words [overflow-wrap:anywhere]"
                      />
                    ) : (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60 break-words [overflow-wrap:anywhere]">
                        {project.description || 'No description provided.'}
                      </p>
                    )}
                  </div>

                  {/* Metadata Info Box */}
                  <div className="border border-slate-200/80 rounded-xl p-4 bg-white divide-y divide-slate-100 text-xs">
                    <div className="flex items-center justify-between pb-3">
                      <span className="text-slate-500 font-medium">Project Key</span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                        {project.key}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-slate-500 font-medium">Project Owner</span>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                          {getUserInitials(owner?.name || 'Admin')}
                        </div>
                        <span className="font-semibold text-slate-800">
                          {owner?.name || 'Workspace Admin'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-slate-500 font-medium">Created Date</span>
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(project.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <span className="text-slate-500 font-medium">Assigned Members</span>
                      <span className="font-semibold text-slate-800">
                        {assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TASKS */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {projectTasks.length} Task{projectTasks.length !== 1 ? 's' : ''} in Project
                    </span>
                  </div>

                  {isTasksLoading ? (
                    <div className="space-y-2 py-4 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 bg-slate-100 rounded-xl" />
                      ))}
                    </div>
                  ) : projectTasks.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl">
                      <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">No tasks created yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Add the first task to begin tracking work for this project.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      {projectTasks.map((task) => {
                        const assignee = users.find((u) => u.id === task.assigneeId);
                        const overdue = isOverdue(task.dueDate, task.status);

                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                {task.title}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {assignee?.name || 'Unassigned'}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span
                                  className={cn(
                                    'text-[10px] font-medium',
                                    overdue ? 'text-rose-600 font-bold' : 'text-slate-400',
                                  )}
                                >
                                  {formatDate(task.dueDate)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <PriorityBadge priority={task.priority} />
                              <span
                                className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase',
                                  task.status === 'DONE'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : task.status === 'IN_PROGRESS'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : task.status === 'IN_REVIEW'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200',
                                )}
                              >
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TEAM MEMBERS */}
              {activeTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Assigned Team Members
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {isAdmin
                          ? 'Select members who have access to this project.'
                          : 'Members collaborating on this project.'}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100">
                      {selectedMemberIds.length} Members
                    </span>
                  </div>

                  {isAdmin && (
                    <input
                      type="text"
                      placeholder="Filter workspace members..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                    />
                  )}

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-80 overflow-y-auto">
                    {(isAdmin ? filteredWorkspaceUsers : assignedMembers).map((user) => {
                      const isAssigned = selectedMemberIds.includes(user.id);

                      return (
                        <div
                          key={user.id}
                          onClick={() => isAdmin && handleToggleMember(user.id)}
                          className={cn(
                            'p-3 flex items-center justify-between transition-colors gap-3',
                            isAdmin ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default',
                            isAssigned && isAdmin ? 'bg-indigo-50/40' : '',
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {getUserInitials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {user.name}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {user.email}
                              </div>
                              {user.designation && (
                                <div className="text-[10px] text-indigo-600 font-medium truncate">
                                  {user.designation}
                                </div>
                              )}
                            </div>
                          </div>

                          {isAdmin && (
                            <div
                              className={cn(
                                'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                                isAssigned
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 bg-white',
                              )}
                            >
                              {isAssigned && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer for Admin Changes */}
        {isAdmin && isDirty && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-amber-600 font-semibold">Unsaved changes</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetChanges}
                disabled={updateProjectMutation.isPending}
                className="text-xs"
              >
                Reset
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={updateProjectMutation.isPending}
                onClick={handleSaveChanges}
                className="text-xs gap-1.5 font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        title="Delete Project"
        description={`Are you sure you want to delete "${project?.name}"? All ${projectTasks.length} tasks associated with this project will also be deleted. This action cannot be undone.`}
        confirmText="Delete Project"
        isLoading={deleteProjectMutation.isPending}
        onConfirm={handleDeleteProject}
        onClose={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
};
