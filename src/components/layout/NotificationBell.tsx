import {
  ArrowRightCircle,
  Bell,
  BellOff,
  CheckSquare,
  Clock,
  Edit3,
  ExternalLink,
  FolderKanban,
  Layers,
  RotateCcw,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useActivitiesQuery } from '@/hooks/useDashboard';
import { cn, formatRelativeTime, getUserInitials } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import type { ActivityAction, ActivityLog } from '@/types';

function getActivityIcon(action: ActivityAction) {
  switch (action) {
    case 'TASK_CREATED':
      return {
        icon: CheckSquare,
        color: 'text-blue-600',
        bg: 'bg-blue-50 border-blue-200',
      };
    case 'TASK_STATUS_CHANGED':
      return {
        icon: ArrowRightCircle,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
      };
    case 'TASK_UPDATED':
      return {
        icon: Edit3,
        color: 'text-amber-600',
        bg: 'bg-amber-50 border-amber-200',
      };
    case 'TASK_DELETED':
      return {
        icon: Trash2,
        color: 'text-rose-600',
        bg: 'bg-rose-50 border-rose-200',
      };
    case 'PROJECT_CREATED':
      return {
        icon: FolderKanban,
        color: 'text-purple-600',
        bg: 'bg-purple-50 border-purple-200',
      };
    case 'MEMBER_ASSIGNED':
      return {
        icon: UserPlus,
        color: 'text-cyan-600',
        bg: 'bg-cyan-50 border-cyan-200',
      };
    case 'COLUMN_CREATED':
    case 'COLUMN_DELETED':
      return {
        icon: Layers,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50 border-indigo-200',
      };
    default:
      return {
        icon: Clock,
        color: 'text-slate-600',
        bg: 'bg-slate-50 border-slate-200',
      };
  }
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TASKS' | 'PROJECTS_MEMBERS'>('ALL');
  const [hasUnread, setHasUnread] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: activities = [], isLoading, isRefetching, refetch } = useActivitiesQuery(30);
  const { setSelectedTaskId, setSelectedProjectIdForDetail } = useTaskStore();

  // Close dropdown on click outside
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

  const handleOpenToggle = () => {
    if (!isOpen) {
      setHasUnread(false);
    }
    setIsOpen((prev) => !prev);
  };

  const handleActivityClick = (activity: ActivityLog) => {
    if (activity.taskId) {
      setSelectedTaskId(activity.taskId);
      setIsOpen(false);
    } else if (activity.projectId) {
      setSelectedProjectIdForDetail(activity.projectId);
      setIsOpen(false);
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (activeFilter === 'TASKS') {
      return (
        act.action === 'TASK_CREATED' ||
        act.action === 'TASK_STATUS_CHANGED' ||
        act.action === 'TASK_UPDATED' ||
        act.action === 'TASK_DELETED'
      );
    }
    if (activeFilter === 'PROJECTS_MEMBERS') {
      return (
        act.action === 'PROJECT_CREATED' ||
        act.action === 'MEMBER_ASSIGNED' ||
        act.action === 'COLUMN_CREATED' ||
        act.action === 'COLUMN_DELETED'
      );
    }
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleOpenToggle}
        className={cn(
          'p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer relative border',
          isOpen
            ? 'bg-slate-100 text-slate-900 border-slate-300'
            : 'border-transparent hover:border-slate-200'
        )}
        title="Workspace notifications & activity"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />

        {/* Unread indicator dot */}
        {hasUnread && activities.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-tight">
                  Activity & Notifications
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  Live workspace updates
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => refetch()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Refresh activities"
              >
                <RotateCcw className={cn('w-3.5 h-3.5', isRefetching && 'animate-spin text-indigo-600')} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-100 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-colors cursor-pointer',
                activeFilter === 'ALL'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              All ({activities.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('TASKS')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-colors cursor-pointer',
                activeFilter === 'TASKS'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('PROJECTS_MEMBERS')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-colors cursor-pointer',
                activeFilter === 'PROJECTS_MEMBERS'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              Team & Projects
            </button>
          </div>

          {/* Activity Feed Scroll Container */}
          <div className="max-h-88 sm:max-h-96 overflow-y-auto divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <BellOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No activity yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Actions taken on tasks, projects, and team members will appear here.
                </p>
              </div>
            ) : (
              filteredActivities.map((act) => {
                const iconInfo = getActivityIcon(act.action);
                const IconComponent = iconInfo.icon;
                const isClickable = Boolean(act.taskId || act.projectId);

                return (
                  <div
                    key={act.id}
                    onClick={() => handleActivityClick(act)}
                    className={cn(
                      'p-3 sm:p-3.5 flex items-start gap-3 transition-colors text-left group',
                      isClickable
                        ? 'hover:bg-slate-50 cursor-pointer'
                        : 'hover:bg-slate-50/50'
                    )}
                  >
                    {/* Action Icon Badge */}
                    <div
                      className={cn(
                        'w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs transition-transform group-hover:scale-105',
                        iconInfo.bg
                      )}
                    >
                      <IconComponent className={cn('w-3.5 h-3.5', iconInfo.color)} />
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-800 leading-relaxed font-normal">
                        <span className="font-bold text-slate-900 mr-1">
                          {act.userName}
                        </span>
                        <span>{act.details}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatRelativeTime(act.timestamp)}
                        </span>

                        {isClickable && (
                          <>
                            <span className="text-slate-300 text-[10px]">•</span>
                            <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-0.5 group-hover:underline">
                              <span>Open details</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium px-4">
            <span>Real-time Workspace Audit</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              TaskFlow v0.1.1
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
