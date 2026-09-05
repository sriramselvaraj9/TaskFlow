import { Menu } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { getUserInitials } from '@/lib/utils';

interface TopBarProps {
  breadcrumb?: { label: string; sub?: string };
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  activeView?: string;
  showSearch?: boolean;
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ breadcrumb, onMenuClick }) => {
  const { data: session } = useSession();

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-5 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between z-10 shrink-0 relative">
      {/* Left side: Hamburger on mobile + Breadcrumb */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 -ml-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors md:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {breadcrumb && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 truncate">
            <span className="text-slate-900 font-bold truncate">{breadcrumb.label}</span>
            {breadcrumb.sub && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500 font-medium truncate">{breadcrumb.sub}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Notifications + User Profile & Role Badge */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Project & Task Creation Notifications for Members & Admin */}
        <NotificationDropdown />

        <div className="h-4 w-[1px] bg-slate-200" />

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm select-none"
            title={session?.user?.name || 'User'}
          >
            {getUserInitials(session?.user?.name || 'User')}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold text-slate-900 leading-tight max-w-[120px] md:max-w-[160px] truncate">
              {session?.user?.name || 'User'}
            </span>
            <div className="mt-0.5">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {session?.user?.role || 'MEMBER'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
