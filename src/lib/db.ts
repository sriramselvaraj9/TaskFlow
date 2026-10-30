/**
 * Authoritative Backend Client Bridge for TaskFlow.
 * 
 * Directs all production domain operations to the live FastAPI backend over HTTP.
 * The backend interacts directly with the single authoritative PostgreSQL database and Redis cache.
 */

import crypto from 'crypto';
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
  UserRole,
} from '@/types';
import { emailService } from '@/lib/emailService';
import { isAdmin } from '@/lib/authHelper';

export { emailService };

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'taskflow-super-secure-production-secret-key-32chars';

function getBackendBaseUrl(): string {
  const rawUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:8000';
  return rawUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

function isTokenExpired(token?: string): boolean {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    // If token expires in less than 30 seconds, consider it expired
    return payload.exp <= now + 30;
  } catch {
    return true;
  }
}

/**
 * Creates a cryptographically signed HS256 access token for server-to-server calls.
 * If an existing client-side access token is attached and still valid, uses it.
 * Otherwise, generates a fresh valid 1-hour access token for the authenticated user session.
 * Uses the authoritative seeded admin account 'user-admin-1' as the fallback subject.
 */
function signInternalToken(user?: Partial<User> & { role?: UserRole; accessToken?: string }): string {
  if (user?.accessToken && !isTokenExpired(user.accessToken)) {
    return user.accessToken;
  }

  // When user is not explicitly specified (server-to-server call), default to Admin authority
  const isUserAdmin = !user || isAdmin(user);
  const userId = user?.id || (isUserAdmin ? 'user-admin-1' : 'user-member-1');
  const role = isUserAdmin ? 'ADMIN' : (user?.role || 'MEMBER');
  const email = user?.email || (isUserAdmin ? 'sriramccbp@gmail.com' : 'member@gmail.com');
  const name = user?.name || (isUserAdmin ? 'Sriram S' : 'Member User');

  const header = { alg: 'HS256', typ: 'JWT' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    email,
    name,
    role,
    type: 'access',
    iat: now,
    nbf: now,
    exp: now + 3600,
    jti: crypto.randomUUID(),
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');

  return `${base64Header}.${base64Payload}.${signature}`;
}

function buildHeaders(
  user?: Partial<User> & { accessToken?: string },
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const token = signInternalToken(user);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...customHeaders,
  };

  const isUserAdmin = !user || isAdmin(user);
  const userId = user?.id || (isUserAdmin ? 'user-admin-1' : 'user-member-1');
  const userRole = isUserAdmin ? 'ADMIN' : (user?.role || 'MEMBER');
  const userEmail = user?.email || (isUserAdmin ? 'sriramccbp@gmail.com' : 'member@gmail.com');
  const userName = user?.name || (isUserAdmin ? 'Sriram S' : 'Member User');

  headers['x-user-id'] = userId;
  headers['x-user-role'] = userRole;
  headers['x-user-email'] = userEmail;
  headers['x-user-name'] = userName;

  return headers;
}

// ============================================================================
// Board Columns
// ============================================================================

export async function getColumns(user?: User): Promise<BoardColumn[]> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/columns`, {
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch columns');
  }
  return res.json();
}

export async function createColumn(
  data: { title: string; dotColor?: string; accentColor?: string },
  user: User
): Promise<BoardColumn> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/columns`, {
    method: 'POST',
    headers: buildHeaders(user),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to create column');
  }
  return res.json();
}

export async function reorderColumns(
  columnIds: string[],
  user: User
): Promise<BoardColumn[]> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/columns/reorder`, {
    method: 'POST',
    headers: buildHeaders(user),
    body: JSON.stringify({ columnIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to reorder columns');
  }
  return res.json();
}

export async function deleteColumn(
  id: string,
  user: User
): Promise<{ success: boolean; movedTasksCount: number; deletedColumn: BoardColumn }> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/columns/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    if (res.status === 404) {
      // Idempotent delete: column is already absent from backend database
      return {
        success: true,
        movedTasksCount: 0,
        deletedColumn: {
          id,
          title: id,
          dotColor: '',
          accentColor: '',
          order: 0,
          createdAt: new Date().toISOString(),
        },
      };
    }
    const err = await res.json().catch(() => ({}));
    if (err.message?.includes('not found') || err.detail?.includes('not found')) {
      return {
        success: true,
        movedTasksCount: 0,
        deletedColumn: {
          id,
          title: id,
          dotColor: '',
          accentColor: '',
          order: 0,
          createdAt: new Date().toISOString(),
        },
      };
    }
    throw new Error(err.message || err.detail || 'Failed to delete column');
  }
  const result = await res.json();
  return {
    success: true,
    movedTasksCount: result.movedTasksCount,
    deletedColumn: result.deletedColumn,
  };
}

export const columnService = {
  getColumns,
  createColumn,
  reorderColumns,
  deleteColumn,
};

// ============================================================================
// Projects
// ============================================================================

export async function getProjects(
  userId?: string,
  userRole?: string,
  user?: User
): Promise<Project[]> {
  const backend = getBackendBaseUrl();
  const authUser = user || (userId ? { id: userId, role: userRole as UserRole } : undefined);
  const res = await fetch(`${backend}/api/projects`, {
    headers: buildHeaders(authUser),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch projects');
  }
  return res.json();
}

export async function getProjectById(
  id: string,
  user?: User
): Promise<Project | undefined> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/projects/${id}`, {
    headers: buildHeaders(user),
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch project');
  }
  return res.json();
}

export async function createProject(
  data: { name: string; key: string; description: string; memberIds: string[] },
  creator: User
): Promise<Project> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/projects`, {
    method: 'POST',
    headers: buildHeaders(creator),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to create project');
  }
  return res.json();
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'memberIds'>>,
  user: User
): Promise<Project> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/projects/${id}`, {
    method: 'PUT',
    headers: buildHeaders(user),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to update project');
  }
  return res.json();
}

export async function deleteProject(id: string, user: User): Promise<boolean> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/projects/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to delete project');
  }
  return true;
}

export const projectService = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};

// ============================================================================
// Tasks
// ============================================================================

export async function getTasks(
  filters?: {
    projectId?: string;
    status?: TaskStatus | 'ALL';
    priority?: TaskPriority | 'ALL';
    assigneeId?: string | 'ALL';
    search?: string;
  },
  user?: User
): Promise<Task[]> {
  const backend = getBackendBaseUrl();
  const query = new URLSearchParams();
  if (filters?.projectId && filters.projectId !== 'ALL') query.set('projectId', filters.projectId);
  if (filters?.status && filters.status !== 'ALL') query.set('status', filters.status);
  if (filters?.priority && filters.priority !== 'ALL') query.set('priority', filters.priority);
  if (filters?.assigneeId && filters.assigneeId !== 'ALL') query.set('assigneeId', filters.assigneeId);
  if (filters?.search) query.set('search', filters.search);

  const res = await fetch(`${backend}/api/tasks?${query.toString()}`, {
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch tasks');
  }
  return res.json();
}

export async function getTaskById(id: string, user?: User): Promise<Task | undefined> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/tasks/${id}`, {
    headers: buildHeaders(user),
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch task');
  }
  return res.json();
}

export async function createTask(
  data: {
    title: string;
    description: string;
    projectId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    startDate?: string;
    dueDate: string;
    tags?: string[];
  },
  creator: User
): Promise<Task> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/tasks`, {
    method: 'POST',
    headers: buildHeaders(creator),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to create task');
  }
  return res.json();
}

export async function updateTask(
  id: string,
  data: Partial<
    Pick<
      Task,
      'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'startDate' | 'dueDate' | 'tags'
    >
  >,
  user: User
): Promise<Task> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/tasks/${id}`, {
    method: 'PUT',
    headers: buildHeaders(user),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to update task');
  }
  return res.json();
}

export async function deleteTask(id: string, user: User): Promise<boolean> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/tasks/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to delete task');
  }
  return true;
}

export const taskService = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};

// ============================================================================
// Dashboard & Activities
// ============================================================================

export async function getDashboardStats(
  userId?: string | null,
  projectId?: string | null,
  user?: User
): Promise<DashboardStats> {
  const backend = getBackendBaseUrl();
  const query = new URLSearchParams();
  if (projectId && projectId !== 'ALL') query.set('projectId', projectId);

  const authUser = user || (userId ? { id: userId } : undefined);
  const res = await fetch(`${backend}/api/dashboard/stats?${query.toString()}`, {
    headers: buildHeaders(authUser),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch dashboard stats');
  }
  return res.json();
}

export async function getActivities(limit = 20, user?: User): Promise<ActivityLog[]> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/activities?limit=${limit}`, {
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch activities');
  }
  return res.json();
}

export async function logActivity(
  action: ActivityAction,
  details: string,
  user: User,
  projectId?: string,
  taskId?: string
): Promise<ActivityLog> {
  return {
    id: `act_${Date.now()}`,
    action,
    details,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    projectId,
    taskId,
    timestamp: new Date().toISOString(),
  };
}

export const activityService = {
  getActivities,
  logActivity,
};

// ============================================================================
// Users & Authentication
// ============================================================================

export async function getUsers(user?: User): Promise<User[]> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/users`, {
    headers: buildHeaders(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch users');
  }
  return res.json();
}

export async function getUserById(id: string, user?: User): Promise<User | undefined> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/users/${id}`, {
    headers: buildHeaders(user),
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to fetch user');
  }
  return res.json();
}

export async function getUserByEmail(email: string, user?: User): Promise<User | undefined> {
  const users = await getUsers(user);
  return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

export async function verifyPassword(email: string, passwordAttempt: string): Promise<boolean> {
  const backend = getBackendBaseUrl();
  try {
    const res = await fetch(`${backend}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password: passwordAttempt }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function provisionUser(
  data: {
    name: string;
    email: string;
    role?: 'ADMIN' | 'MEMBER';
    designation?: string;
    frontendUrl?: string;
    password?: string;
  },
  adminUser?: User
): Promise<{
  message: string;
  user: User;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
}> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/users/create`, {
    method: 'POST',
    headers: buildHeaders(adminUser),
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      role: data.role || 'MEMBER',
      designation: data.designation,
      password: data.password,
      frontendUrl: data.frontendUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to provision member');
  }
  return res.json();
}


export async function requestForgotPassword(
  email: string,
  frontendUrl?: string
): Promise<{
  success: boolean;
  message: string;
  emailSent: boolean;
}> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      frontendUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to request password reset');
  }
  return res.json();
}


export async function deleteUser(id: string, adminUser: User): Promise<boolean> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/users/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(adminUser),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to delete user');
  }
  return true;
}

export async function setPasswordWithInviteToken(
  email: string,
  token: string,
  password: string,
  name?: string
): Promise<User> {
  const backend = getBackendBaseUrl();
  const res = await fetch(`${backend}/api/auth/set-password`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email, token, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to activate password');
  }
  const result = await res.json();
  return result.user;
}
