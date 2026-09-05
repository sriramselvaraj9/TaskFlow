import type {
  ActivityAction,
  ActivityLog,
  BoardColumn,
  DashboardStats,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from '@/types';
import { getDatabase, resetDatabase, saveDbToFile } from './data';
import { columnRepository } from './repositories/column.repository';
import { projectRepository } from './repositories/project.repository';
import { taskRepository } from './repositories/task.repository';
import { userRepository } from './repositories/user.repository';
import { activityService } from './services/activity.service';
import { adminService } from './services/admin.service';
import { authService } from './services/auth.service';
import { columnService } from './services/column.service';
import { emailService } from './services/email.service';
import { projectService } from './services/project.service';
import { taskService } from './services/task.service';

// Export Database utilities
// Export Repositories
// Export Services
export {
  activityService,
  adminService,
  authService,
  columnRepository,
  columnService,
  emailService,
  getDatabase,
  projectRepository,
  projectService,
  resetDatabase,
  saveDbToFile,
  taskRepository,
  taskService,
  userRepository,
};

// Board Column methods delegation
export async function getColumns(): Promise<BoardColumn[]> {
  return columnService.getColumns();
}

export async function createColumn(
  data: { title: string; dotColor?: string; accentColor?: string },
  user: User,
): Promise<BoardColumn> {
  return columnService.createColumn(data, user);
}

export async function deleteColumn(
  id: string,
  user: User,
): Promise<{ success: boolean; movedTasksCount: number; deletedColumn: BoardColumn }> {
  return columnService.deleteColumn(id, user);
}

// Activity logging delegation
export async function logActivity(
  action: ActivityAction,
  details: string,
  user: User,
  projectId?: string,
  taskId?: string,
): Promise<ActivityLog> {
  return activityService.logActivity(action, details, user, projectId, taskId);
}

// User methods delegation
export async function getUsers(): Promise<User[]> {
  return adminService.getAllUsers();
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return authService.getUserByEmail(email);
}

export async function getUserById(id: string): Promise<User | undefined> {
  return authService.getUserById(id);
}

export async function verifyPassword(email: string, passwordAttempt: string): Promise<boolean> {
  return authService.verifyPassword(email, passwordAttempt);
}

export async function createUser(data: {
  name: string;
  email: string;
  designation?: string;
  passwordAttempt?: string;
  password?: string;
  role?: 'ADMIN' | 'MEMBER';
}): Promise<User> {
  return authService.registerUser(data);
}

export async function resetPassword(email: string, newPasswordAttempt: string): Promise<boolean> {
  return authService.resetPassword(email, newPasswordAttempt);
}

export async function createOTP(email: string): Promise<string> {
  return authService.createOTP(email);
}

export async function verifyAndResetPasswordWithOTP(
  email: string,
  otp: string,
  newPasswordAttempt: string,
): Promise<boolean> {
  return authService.verifyAndResetPasswordWithOTP(email, otp, newPasswordAttempt);
}

export async function deleteUser(id: string, adminUser: User): Promise<boolean> {
  return adminService.deleteUser(id, adminUser);
}

// Project methods delegation
export async function getProjects(userId?: string, userRole?: string): Promise<Project[]> {
  return projectService.getProjects(userId, userRole);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return projectService.getProjectById(id);
}

export async function createProject(
  data: { name: string; key: string; description: string; memberIds: string[] },
  creator: User,
): Promise<Project> {
  return projectService.createProject(data, creator);
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'memberIds'>>,
  user: User,
): Promise<Project> {
  return projectService.updateProject(id, data, user);
}

export async function deleteProject(id: string, user: User): Promise<boolean> {
  return projectService.deleteProject(id, user);
}

// Task methods delegation
export async function getTasks(filters?: {
  projectId?: string;
  status?: TaskStatus | 'ALL';
  priority?: TaskPriority | 'ALL';
  assigneeId?: string | 'ALL';
  search?: string;
}): Promise<Task[]> {
  return taskService.getTasks(filters);
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  return taskService.getTaskById(id);
}

export async function createTask(
  data: {
    title: string;
    description: string;
    projectId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    dueDate: string;
    tags?: string[];
  },
  creator: User,
): Promise<Task> {
  return taskService.createTask(data, creator);
}

export async function updateTask(
  id: string,
  data: Partial<
    Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'dueDate' | 'tags'>
  >,
  user: User,
): Promise<Task> {
  return taskService.updateTask(id, data, user);
}

export async function deleteTask(id: string, user: User): Promise<boolean> {
  return taskService.deleteTask(id, user);
}

// Activity & Stats methods delegation
export async function getActivities(limit = 20): Promise<ActivityLog[]> {
  return activityService.getActivities(limit);
}

export async function getDashboardStats(userId?: string | null): Promise<DashboardStats> {
  return taskService.getDashboardStats(userId || undefined);
}
