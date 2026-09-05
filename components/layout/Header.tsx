import { FolderKanban, Layers, LogOut, Plus, Search } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import type React from 'react';
import { Button } from '@/components/ui/Button';
import { useProjectsQuery } from '@/hooks/useProjects';
import { useTaskStore } from '@/store/useTaskStore';

export const Header: React.FC = () => {
  const { data: session } = useSession();
  const { data: projects = [] } = useProjectsQuery();

  const {
    selectedProjectId,
    setSelectedProjectId,
    searchQuery,
    setSearchQuery,
    setCreateTaskOpen,
    setCreateProjectOpen,
  } = useTaskStore();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = '/auth/signin';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left side: Brand + Project Switcher */}
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-400 text-black shadow-inner font-bold">
            <Layers className="h-5 w-5 text-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">TaskFlow</span>
              <span className="rounded bg-zinc-800/80 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-400 border border-zinc-700/50">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono hidden sm:block">Team Task Engine</p>
          </div>
        </div>

        {/* Project Selector Dropdown */}
        <div className="relative flex items-center">
          <div className="h-5 w-[1px] bg-zinc-800 mx-2 hidden sm:block" />
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-zinc-400 hidden sm:block" />
            <select
              value={selectedProjectId || 'ALL'}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === 'ALL' ? null : e.target.value)
              }
              className="bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-700 cursor-pointer font-medium hover:bg-zinc-850 transition-colors"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  [{proj.key}] {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Middle: Quick Search */}
      <div className="hidden md:flex flex-1 max-w-xs mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-700 transition-all"
          />
        </div>
      </div>

      {/* Right side: Actions & User Info */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* New Project Button (if Admin) */}
        {session?.user?.role === 'ADMIN' && (
          <Button
            variant="ghost"
            onClick={() => setCreateProjectOpen(true)}
            className="text-xs h-8 px-2.5 border border-zinc-800 hover:border-zinc-700 hidden sm:inline-flex"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Project
          </Button>
        )}

        {/* New Task Button (Admin Only) */}
        {session?.user?.role === 'ADMIN' && (
          <Button
            variant="primary"
            onClick={() => setCreateTaskOpen(true)}
            className="text-xs h-8 px-3 font-semibold shadow-sm hover:shadow"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Task
          </Button>
        )}

        {/* User Profile / Logout */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-zinc-800">
          <div className="hidden lg:block text-left">
            <div className="text-xs font-medium text-zinc-200 leading-tight">
              {session?.user?.name || 'Guest'}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <span>{session?.user?.role || 'MEMBER'}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 rounded-lg transition-colors ml-1 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
