import {
  BarChart3,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type ActiveView = 'dashboard' | 'kanban' | 'list' | 'analytics' | 'projects' | 'members';

interface SidebarProps {
  activeView: ActiveView;
  onViewChange?: (view: ActiveView) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard' as ActiveView, href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kanban' as ActiveView, href: '/tasks', label: 'Task Board', icon: KanbanSquare },
  { id: 'members' as ActiveView, href: '/members', label: 'Team Members', icon: Users },
  { id: 'projects' as ActiveView, href: '/projects', label: 'Projects', icon: FolderKanban },
  { id: 'analytics' as ActiveView, href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNavClick = (id: ActiveView, href: string) => {
    if (onViewChange) {
      onViewChange(id);
    }
    if (onMobileClose) {
      onMobileClose();
    }
    router.push(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f1422]">
      {/* Logo & Collapse Header */}
      <div
        className={cn(
          'border-b border-white/8 transition-all shrink-0',
          isCollapsed
            ? 'py-3.5 px-2 flex flex-col items-center gap-2'
            : 'py-4 px-4 flex items-center justify-between',
        )}
      >
        <Link
          href="/dashboard"
          onClick={() => onMobileClose?.()}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
          title={isCollapsed ? 'Taskflow Dashboard' : undefined}
        >
          <div className="w-8 h-8 rounded-xl bg-[#4f46e5] group-hover:bg-[#4338ca] flex items-center justify-center text-white shadow-md shrink-0 transition-colors">
            <CheckSquare className="w-4 h-4" />
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <span className="text-base font-bold text-white tracking-tight truncate animate-fade-in">
              Taskflow
            </span>
          )}
        </Link>

        {/* Mobile Close Button */}
        {isMobileOpen ? (
          <button
            type="button"
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors md:hidden"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          /* Desktop Collapse / Expand Toggle Button */
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4 h-4 text-indigo-400" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pt-4 pb-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, href, label, icon: Icon }) => {
          const isActive =
            activeView === id ||
            (id === 'kanban' && (activeView === 'list' || router.pathname === '/tasks')) ||
            router.pathname === href;

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavClick(id, href)}
              title={isCollapsed && !isMobileOpen ? label : undefined}
              className={cn(
                'w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 text-left cursor-pointer',
                isCollapsed && !isMobileOpen ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5',
                isActive
                  ? 'bg-[#1d263a] text-white shadow-sm ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-indigo-400' : 'text-slate-400',
                )}
              />
              {(!isCollapsed || isMobileOpen) && <span className="flex-1 truncate">{label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile < md) */}
      <aside
        className={cn(
          'hidden md:flex h-screen bg-[#0f1422] border-r border-white/8 flex-col shrink-0 z-20 transition-all duration-300 overflow-hidden',
          isCollapsed ? 'w-16' : 'w-[220px]',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Overlay (< md) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-slide-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
