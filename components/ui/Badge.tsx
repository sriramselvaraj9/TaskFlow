import type React from 'react';
import { cn, getPriorityBadgeColor, getStatusBadgeDetails } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types';

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const styles = getPriorityBadgeColor(priority);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-sm whitespace-nowrap select-none',
        styles.bg,
        styles.text,
        styles.border,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse-subtle shrink-0', styles.dot)} />
      <span className="whitespace-nowrap">{priority}</span>
    </span>
  );
};

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showDot = true }) => {
  const details = getStatusBadgeDetails(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-sm whitespace-nowrap select-none',
        details.bg,
        details.text,
        details.border,
        className,
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', details.dot)} />}
      <span className="whitespace-nowrap">{details.label}</span>
    </span>
  );
};
