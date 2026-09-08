import { ChevronDown, LogOut, Mail, Menu, Shield, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = '/auth/signin';
  };

  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || 'user@taskflow.dev';
  const userRole = session?.user?.role || 'MEMBER';

  return (
    <>
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

        {/* Right Controls: Interactive User Profile & Role Badge */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 sm:gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer border border-transparent hover:border-slate-200 group text-left"
            title="View member details"
          >
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 group-hover:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm select-none transition-colors"
            >
              {getUserInitials(userName)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold text-slate-900 leading-tight max-w-[120px] md:max-w-[160px] truncate">
                {userName}
              </span>
              <div className="mt-0.5">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {userRole}
                </span>
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 hidden sm:block ${
                isProfileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Member Details Popover Modal */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 animate-scale-in">
              {/* Header with Avatar & Name */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-md">
                    {getUserInitials(userName)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{userName}</h4>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{userEmail}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Member Details Info List */}
              <div className="py-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    Role
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 uppercase tracking-wider shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {userRole}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Session Status</span>
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Authenticated
                  </span>
                </div>
              </div>

              {/* Footer: Logout Action */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsLogoutConfirmOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-100 hover:border-rose-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        title="Confirm Logout"
        description="Are you sure you want to log out of your TaskFlow workspace session?"
        confirmText="Log Out"
        cancelText="Cancel"
        onConfirm={handleSignOut}
        onClose={() => setIsLogoutConfirmOpen(false)}
      />
    </>
  );
};
