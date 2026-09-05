import { Calendar, FolderKanban, Plus, RotateCcw, Search, Users, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useUsersQuery } from '@/hooks/useUsers';
import { formatDate } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';

const _PROJECT_COLORS = [
  'from-indigo-600/10 via-surface-base to-surface-base border-indigo-500/20 hover:border-indigo-500/40',
  'from-emerald-600/10 via-surface-base to-surface-base border-emerald-500/20 hover:border-emerald-500/40',
  'from-violet-600/10 via-surface-base to-surface-base border-violet-500/20 hover:border-violet-500/40',
  'from-amber-600/10 via-surface-base to-surface-base border-amber-500/20 hover:border-amber-500/40',
  'from-rose-600/10 via-surface-base to-surface-base border-rose-500/20 hover:border-rose-500/40',
  'from-cyan-600/10 via-surface-base to-surface-base border-cyan-500/20 hover:border-cyan-500/40',
];

const _DOT_COLORS = [
  'bg-indigo-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]',
  'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  'bg-violet-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]',
  'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]',
  'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]',
];

export const ProjectsView: React.FC = () => {
  const { data: session } = useSession();
  const { data: allProjects = [], isLoading } = useProjectsQuery();
  const { data: users = [] } = useUsersQuery();
  const { searchQuery, setSearchQuery, setCreateProjectOpen, setSelectedProjectIdForDetail } =
    useTaskStore();

  const isAdmin = session?.user?.role === 'ADMIN';
  const cleanQuery = (searchQuery || '').trim().toLowerCase();

  const projects = cleanQuery
    ? allProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(cleanQuery) ||
          p.key.toLowerCase().includes(cleanQuery) ||
          p.description?.toLowerCase().includes(cleanQuery),
      )
    : allProjects;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl animate-pulse">
        <div className="h-12 w-60 bg-surface-base rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-surface-base rounded-2xl border border-white/8" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Projects</h1>
          <p className="text-xs text-slate-500 mt-1">
            {cleanQuery ? (
              <span>
                Found <span className="font-bold text-slate-900">{projects.length}</span> matching
                project{projects.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
              </span>
            ) : (
              <span>
                {projects.length} project{projects.length !== 1 ? 's' : ''} in workspace
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-sm font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Project Grid / Empty State */}
      {allProjects.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
          <FolderKanban className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-800 font-bold text-base">No projects found</p>
          <p className="text-slate-400 text-xs mt-1">
            {isAdmin
              ? 'Create your first project workspace to get started.'
              : 'Ask an admin to create a project and assign you.'}
          </p>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
          <Search className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-800 font-bold text-base">
            No projects found matching &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Check for typos or try searching with different keywords.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Clear Search</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project, _idx) => {
            const members = users.filter((u) => project.memberIds.includes(u.id));

            return (
              <div
                key={project.id}
                onClick={() => setSelectedProjectIdForDetail(project.id)}
                className="group relative bg-white border border-slate-200 rounded-2xl p-5 transition-all duration-150 cursor-pointer hover:border-indigo-300 hover:shadow-md shadow-card active:scale-[0.99]"
              >
                {/* Project Key + Name */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0 pr-12">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {project.key}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 line-clamp-2 mb-5 leading-relaxed pl-5 font-normal">
                  {project.description}
                </p>

                {/* Bottom: Members + Date */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 pl-5">
                  {/* Members */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{members.length} Members</span>
                  </div>

                  {/* Created date */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(project.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
