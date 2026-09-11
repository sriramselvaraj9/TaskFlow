import type { ActivityLog, BoardColumn, Project, Task, User } from '@/types';

export interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>;
  projects: Project[];
  tasks: Task[];
  columns: BoardColumn[];
  activities: ActivityLog[];
  otpTokens?: Record<string, { code: string; expiresAt: string }>;
  inviteTokens?: Record<string, { token: string; expiresAt: string }>;
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
  const users: User[] = [
    {
      id: 'user-admin-1',
      name: 'Sriram S',
      email: 'sriramccbp@gmail.com',
      role: 'ADMIN',
      designation: 'Lead Administrator',
      createdAt: '2026-09-08T00:00:00.000Z',
    },
    {
      id: 'user-member-1',
      name: 'Member User',
      email: 'member@gmail.com',
      role: 'MEMBER',
      designation: 'Software Engineer',
      createdAt: '2026-09-08T00:00:00.000Z',
    },
  ];

  const passwords: Record<string, string> = {
    'sriramccbp@gmail.com': '$2a$08$6MLZwjUPsb.ljnT0PQ02oO9pNhfd.GWctFYTvlldkj/8W19eP4Lyu',
    'sriramcccbp@gmail.com': '$2a$08$6MLZwjUPsb.ljnT0PQ02oO9pNhfd.GWctFYTvlldkj/8W19eP4Lyu',
    'member@gmail.com': '$2a$08$HFVFArhqzFozzjQiwG3seepzIYNCq.r1pfXdcJV90ZtAr93vgjaGe',
  };

  const projects: Project[] = [];
  const tasks: Task[] = [];
  const columns: BoardColumn[] = getDefaultColumns();
  const activities: ActivityLog[] = [];
  const otpTokens: Record<string, { code: string; expiresAt: string }> = {};
  const inviteTokens: Record<string, { token: string; expiresAt: string }> = {};

  return {
    users,
    passwords,
    projects,
    tasks,
    columns,
    activities,
    otpTokens,
    inviteTokens,
  };
}
