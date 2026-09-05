import type { Project, Task, User } from '@/types';

const STORAGE_KEYS = {
  USERS: 'taskflow_client_users_v1',
  PROJECTS: 'taskflow_client_projects_v1',
  TASKS: 'taskflow_client_tasks_v1',
  DELETED_IDS: 'taskflow_client_deleted_ids_v1',
};

function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // quota exceeded or private mode
  }
}

function getDeletedIds(): Set<string> {
  const ids = safeGetItem<string[]>(STORAGE_KEYS.DELETED_IDS, []);
  return new Set(ids);
}

function recordDeletedId(id: string): void {
  const ids = getDeletedIds();
  ids.add(id);
  safeSetItem(STORAGE_KEYS.DELETED_IDS, Array.from(ids));
}

// ----------------- USERS -----------------
export function getLocalUsers(): User[] {
  return safeGetItem<User[]>(STORAGE_KEYS.USERS, []);
}

export function saveLocalUser(user: User): void {
  const current = getLocalUsers();
  const deleted = getDeletedIds();
  deleted.delete(user.id);
  safeSetItem(STORAGE_KEYS.DELETED_IDS, Array.from(deleted));

  const index = current.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  if (index >= 0) {
    current[index] = { ...current[index], ...user };
  } else {
    current.push(user);
  }
  safeSetItem(STORAGE_KEYS.USERS, current);
}

export function removeLocalUser(id: string): void {
  recordDeletedId(id);
  const current = getLocalUsers().filter((u) => u.id !== id);
  safeSetItem(STORAGE_KEYS.USERS, current);
}

export function mergeUsersWithLocal(serverUsers: User[]): User[] {
  const deleted = getDeletedIds();
  const local = getLocalUsers();
  const userMap = new Map<string, User>();

  // Add server users (filtering out deleted)
  for (const u of serverUsers) {
    if (!deleted.has(u.id)) {
      userMap.set(u.id, u);
    }
  }

  // Overlay local created/modified users
  for (const u of local) {
    if (!deleted.has(u.id)) {
      userMap.set(u.id, { ...userMap.get(u.id), ...u });
    }
  }

  const merged = Array.from(userMap.values());
  safeSetItem(STORAGE_KEYS.USERS, merged);
  return merged;
}

// ----------------- PROJECTS -----------------
export function getLocalProjects(): Project[] {
  return safeGetItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
}

export function saveLocalProject(project: Project): void {
  const current = getLocalProjects();
  const deleted = getDeletedIds();
  deleted.delete(project.id);
  safeSetItem(STORAGE_KEYS.DELETED_IDS, Array.from(deleted));

  const index = current.findIndex((p) => p.id === project.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...project };
  } else {
    current.unshift(project);
  }
  safeSetItem(STORAGE_KEYS.PROJECTS, current);
}

export function removeLocalProject(id: string): void {
  recordDeletedId(id);
  const current = getLocalProjects().filter((p) => p.id !== id);
  safeSetItem(STORAGE_KEYS.PROJECTS, current);
}

export function mergeProjectsWithLocal(serverProjects: Project[]): Project[] {
  const deleted = getDeletedIds();
  const local = getLocalProjects();
  const projectMap = new Map<string, Project>();

  for (const p of serverProjects) {
    if (!deleted.has(p.id)) {
      projectMap.set(p.id, p);
    }
  }

  for (const p of local) {
    if (!deleted.has(p.id)) {
      projectMap.set(p.id, { ...projectMap.get(p.id), ...p });
    }
  }

  const merged = Array.from(projectMap.values());
  safeSetItem(STORAGE_KEYS.PROJECTS, merged);
  return merged;
}

// ----------------- TASKS -----------------
export function getLocalTasks(): Task[] {
  return safeGetItem<Task[]>(STORAGE_KEYS.TASKS, []);
}

export function saveLocalTask(task: Task): void {
  const current = getLocalTasks();
  const deleted = getDeletedIds();
  deleted.delete(task.id);
  safeSetItem(STORAGE_KEYS.DELETED_IDS, Array.from(deleted));

  const index = current.findIndex((t) => t.id === task.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...task };
  } else {
    current.unshift(task);
  }
  safeSetItem(STORAGE_KEYS.TASKS, current);
}

export function removeLocalTask(id: string): void {
  recordDeletedId(id);
  const current = getLocalTasks().filter((t) => t.id !== id);
  safeSetItem(STORAGE_KEYS.TASKS, current);
}

export function mergeTasksWithLocal(serverTasks: Task[]): Task[] {
  const deleted = getDeletedIds();
  const local = getLocalTasks();
  const taskMap = new Map<string, Task>();

  for (const t of serverTasks) {
    if (!deleted.has(t.id)) {
      taskMap.set(t.id, t);
    }
  }

  for (const t of local) {
    if (!deleted.has(t.id)) {
      taskMap.set(t.id, { ...taskMap.get(t.id), ...t });
    }
  }

  const merged = Array.from(taskMap.values());
  safeSetItem(STORAGE_KEYS.TASKS, merged);
  return merged;
}
