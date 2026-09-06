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
      email: 'admin@gmail.com',
      role: 'ADMIN',
      createdAt: '2026-09-04T12:37:26.392Z',
    },
    {
      id: 'user-member-1',
      name: 'Sriram Selvaraj',
      email: 'member@gmail.com',
      role: 'MEMBER',
      createdAt: '2026-09-04T12:37:26.392Z',
    },
  ];

  const passwords: Record<string, string> = {
    'admin@gmail.com': '$2a$08$sCY6CSVv9vIruTo0LuS/cetB1xxEii75Ojvlcwi1EwveEp57/PMdO',
    'member@gmail.com': '$2a$08$oLaExbWrsJGK1iMomXX2MOwPU2P7Z6IFIT7Zh.oyl40luTs4Q.f0O',
  };

  const projects: Project[] = [
    {
      id: 'prj-1788525755983',
      name: 'API',
      key: 'API',
      description: 'API project',
      status: 'ACTIVE',
      ownerId: 'user-admin-1',
      memberIds: ['user-admin-1', 'user-member-1'],
      createdAt: '2026-09-04T12:42:35.983Z',
      updatedAt: '2026-09-04T12:42:35.983Z',
    },
    {
      id: 'prj-1',
      name: 'Executive Platform',
      key: 'EXEC',
      description: 'Enterprise workflow tracking and reporting platform.',
      status: 'ACTIVE',
      ownerId: 'user-admin-1',
      memberIds: ['user-admin-1', 'user-member-1'],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
    {
      id: 'prj-2',
      name: 'Zenith Hub',
      key: 'ZH',
      description: 'Internal core infrastructure and API gateways.',
      status: 'ACTIVE',
      ownerId: 'user-admin-1',
      memberIds: ['user-admin-1'],
      createdAt: '2026-09-02T11:30:00.000Z',
      updatedAt: '2026-09-04T11:00:00.000Z',
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Core Database Indexing & Optimizations',
      description: 'Review slow queries and apply composite indexes on active columns.',
      status: 'TODO',
      priority: 'HIGH',
      projectId: 'prj-2',
      assigneeId: 'user-admin-1',
      dueDate: '2026-09-12T00:00:00.000Z',
      tags: ['Backend', 'Database'],
      createdById: 'user-admin-1',
      createdAt: '2026-09-04T08:00:00.000Z',
      updatedAt: '2026-09-04T08:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'API Gateway Rate Limiting & Auth Tokens',
      description: 'Implement token bucket algorithm for public endpoints.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      projectId: 'prj-1',
      assigneeId: 'user-member-1',
      dueDate: '2026-09-14T00:00:00.000Z',
      tags: ['API', 'Security'],
      createdById: 'user-admin-1',
      createdAt: '2026-09-04T08:30:00.000Z',
      updatedAt: '2026-09-04T09:00:00.000Z',
    },
    {
      id: 'task-3',
      title: 'Authentication & Permissions Security Review',
      description: 'Conduct role-based access control audit for Admin and Member privileges.',
      status: 'IN_REVIEW',
      priority: 'HIGH',
      projectId: 'prj-1',
      assigneeId: 'user-admin-1',
      dueDate: '2026-09-10T00:00:00.000Z',
      tags: ['RBAC', 'Auth'],
      createdById: 'user-admin-1',
      createdAt: '2026-09-04T09:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
    {
      id: 'task-4',
      title: 'Design System Responsive Audit & Dark Mode',
      description: 'Audit breakpoints and optimize mobile viewport navigation drawer.',
      status: 'DONE',
      priority: 'MEDIUM',
      projectId: 'prj-1',
      assigneeId: 'user-member-1',
      dueDate: '2026-09-08T00:00:00.000Z',
      tags: ['Frontend', 'UI'],
      createdById: 'user-admin-1',
      createdAt: '2026-09-03T10:00:00.000Z',
      updatedAt: '2026-09-04T11:00:00.000Z',
    },
    {
      id: 'task-5',
      title: 'Export Audit Logs & Analytics Pipeline',
      description: 'Build CSV export for team activity logs and member performance.',
      status: 'DONE',
      priority: 'LOW',
      projectId: 'prj-2',
      assigneeId: 'user-admin-1',
      dueDate: '2026-09-07T00:00:00.000Z',
      tags: ['Analytics', 'CSV'],
      createdById: 'user-admin-1',
      createdAt: '2026-09-02T14:00:00.000Z',
      updatedAt: '2026-09-04T11:30:00.000Z',
    },
  ];

  const columns: BoardColumn[] = getDefaultColumns();

  const activities: ActivityLog[] = [
    {
      id: 'act-1788525755985-dkwu',
      action: 'PROJECT_CREATED',
      details: 'created project "API" (API)',
      userId: 'user-admin-1',
      userName: 'Sriram S',
      userRole: 'ADMIN',
      projectId: 'prj-1788525755983',
      timestamp: '2026-09-04T12:42:35.985Z',
    },
  ];

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
