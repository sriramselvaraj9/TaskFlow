export type UserRole = 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation?: string;
  createdAt: string;
}
// literal union types allows to extend later
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | string;
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface BoardColumn {
  id: string;
  title: string;
  dotColor: string;
  accentColor: string;
  order: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate: string;
  tags: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}
// Union Types for type safety
export type ActivityAction =
  | 'TASK_CREATED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'PROJECT_CREATED'
  | 'MEMBER_ASSIGNED'
  | 'COLUMN_CREATED'
  | 'COLUMN_DELETED';

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  details: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  projectId?: string;
  taskId?: string;
  timestamp: string;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  overdueCount: number;
  assignedToMe: number;
  activeProjects: number;
  completionRate: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<TaskPriority, number>;
}
