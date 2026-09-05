import { Bell, CheckCheck, CheckSquare, FolderPlus, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivitiesQuery } from '@/hooks/useDashboard';
import { formatRelativeTime } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import type { ActivityLog } from '@/types';

const READ_STORAGE_KEY = 'taskflow_read_notifications';

export const NotificationDropdown: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { setSelectedTaskId, setSelectedProjectIdForDetail } = useTaskStore();
  const { data: activities = [], refetch } = useActivitiesQuery(30);

  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userRole = session?.user?.role;
  const isAuthorized = userRole === 'ADMIN' || userRole === 'MEMBER';

  // Load read notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(READ_STORAGE_KEY);
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Sync read notifications to localStorage
  const saveReadIds = (newReadIds: string[]) => {
    setReadIds(newReadIds);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(newReadIds));
    } catch {
      // Ignore storage errors
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter creation activities only (PROJECT_CREATED and TASK_CREATED)
  const notifications = useMemo(() => {
    if (!isAuthorized) return [];
    return activities.filter(
      (act) => act.action === 'PROJECT_CREATED' || act.action === 'TASK_CREATED',
    );
  }, [activities, isAuthorized]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !readIds.includes(item.id)).length;
  }, [notifications, readIds]);

  const handleToggle = () => {
    if (!isOpen) {
      refetch();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = notifications.map((n) => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    saveReadIds(updated);
  };

  const handleItemClick = (notification: ActivityLog) => {
    // Mark as read
    if (!readIds.includes(notification.id)) {
      saveReadIds([...readIds, notification.id]);
    }

    setIsOpen(false);

    if (notification.action === 'PROJECT_CREATED') {
      if (notification.projectId) {
        setSelectedProjectIdForDetail(notification.projectId);
      }
      if (router.pathname !== '/projects') {
        router.push('/projects');
      }
    } else if (notification.action === 'TASK_CREATED') {
      if (notification.taskId) {
        setSelectedTaskId(notification.taskId);
      }
      if (router.pathname !== '/tasks') {
        router.push('/tasks');
      }
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded-xl transition-all cursor-pointer ${
          isOpen
            ? 'bg-indigo-50 text-indigo-600'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title="Project & Task Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />

        {/* Unread indicator */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4f46e5]" />
          </span>
        )}
      </button>

      {/* Notifications Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Popover Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-2.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] mx-auto">
                  New project and task creation updates for members and admin will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !readIds.includes(item.id);
                const isProject = item.action === 'PROJECT_CREATED';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-50/80 ${
                      isUnread ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Icon Badge */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isProject
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}
                    >
                      {isProject ? (
                        <FolderPlus className="w-4 h-4" />
                      ) : (
                        <CheckSquare className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-[11px] font-bold ${
                            isProject ? 'text-emerald-700' : 'text-indigo-700'
                          }`}
                        >
                          {isProject ? 'New Project Created' : 'New Task Created'}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-snug line-clamp-2">
                        {item.details}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          By {item.userName}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {item.userRole}
                        </span>
                      </div>
                    </div>

                    {/* Unread blue dot */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium">
              Real-time workspace creation feed
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
