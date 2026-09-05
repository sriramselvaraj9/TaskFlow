import bcrypt from 'bcryptjs';
import type { ActivityLog, BoardColumn, Project, Task, User } from '@/types';

export interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>;
  projects: Project[];
  tasks: Task[];
  columns: BoardColumn[];
  activities: ActivityLog[];
  otpTokens?: Record<string, { code: string; expiresAt: string }>;
}

export function getDefaultColumns(): BoardColumn[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'TODO',
      title: 'TODO',
      accentColor: 'border-slate-900',
      dotColor: 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]',
      order: 0,
      createdAt: now,
    },
    {
      id: 'IN_PROGRESS',
      title: 'In Progress',
      accentColor: 'border-slate-900',
      dotColor: 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]',
      order: 1,
      createdAt: now,
    },
    {
      id: 'IN_REVIEW',
      title: 'In Review',
      accentColor: 'border-slate-900',
      dotColor: 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]',
      order: 2,
      createdAt: now,
    },
    {
      id: 'DONE',
      title: 'Done',
      accentColor: 'border-slate-900',
      dotColor: 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]',
      order: 3,
      createdAt: now,
    },
  ];
}

export function getInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();

  const users: User[] = [
    {
      id: 'user-admin-1',
      name: 'Sriram S',
      email: 'sriramccbp@gmail.com',
      role: 'ADMIN',
      createdAt: now,
    },
    {
      id: 'user-member-1',
      name: 'Sriram Selvaraj',
      email: 'sriramselvaraj799@gmail.com',
      role: 'MEMBER',
      createdAt: now,
    },
  ];

  const passwords: Record<string, string> = {
    'sriramccbp@gmail.com': bcrypt.hashSync('AdminPass@2026', 8),
    'sriramselvaraj799@gmail.com': bcrypt.hashSync('MemberPass@2026', 8),
  };

  const projects: Project[] = [];
  const tasks: Task[] = [];
  const columns: BoardColumn[] = getDefaultColumns();
  const activities: ActivityLog[] = [];
  const otpTokens: Record<string, { code: string; expiresAt: string }> = {};

  return {
    users,
    passwords,
    projects,
    tasks,
    columns,
    activities,
    otpTokens,
  };
}
