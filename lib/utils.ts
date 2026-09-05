import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { TaskPriority, TaskStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

export function isOverdue(dueDateString: string, status: TaskStatus): boolean {
  if (status === 'DONE') return false;
  try {
    const dueDate = new Date(dueDateString);
    const now = new Date();
    return dueDate.getTime() < now.getTime();
  } catch {
    return false;
  }
}

export function getPriorityBadgeColor(priority: TaskPriority): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (priority) {
    case 'URGENT':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        border: 'border-rose-100',
        dot: 'bg-rose-500',
      };
    case 'HIGH':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-100',
        dot: 'bg-amber-500',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        border: 'border-indigo-100',
        dot: 'bg-indigo-500',
      };
    case 'LOW':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

export function getStatusBadgeDetails(status: TaskStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case 'BACKLOG':
      return {
        label: 'Backlog',
        bg: 'bg-zinc-100',
        text: 'text-zinc-700',
        border: 'border-zinc-300',
        dot: 'bg-zinc-500',
      };
    case 'TODO':
      return {
        label: 'TODO',
        bg: 'bg-slate-100',
        text: 'text-slate-900 font-bold',
        border: 'border-slate-300',
        dot: 'bg-slate-900 shadow-[0_0_6px_rgba(15,23,42,0.6)]',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        border: 'border-indigo-100',
        dot: 'bg-indigo-500',
      };
    case 'IN_REVIEW':
      return {
        label: 'In Review',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-100',
        dot: 'bg-amber-500',
      };
    case 'DONE':
      return {
        label: 'Done',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-100',
        dot: 'bg-emerald-500',
      };
    default:
      return {
        label: String(status).replace(/_/g, ' '),
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        dot: 'bg-purple-500',
      };
  }
}

export function getUserInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
