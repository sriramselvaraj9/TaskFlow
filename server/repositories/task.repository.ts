import crypto from 'node:crypto';
import type { Task, TaskPriority, TaskStatus, User } from '@/types';
import { getDatabase, saveDbToFile } from '../data';

export class TaskRepository {
  async findAll(filters?: {
    projectId?: string | null;
    status?: TaskStatus | 'ALL';
    priority?: TaskPriority | 'ALL';
    assigneeId?: string | 'ALL';
    search?: string;
  }): Promise<Task[]> {
    const db = getDatabase();
    let tasks = [...db.tasks];

    if (filters?.projectId && filters.projectId !== 'ALL') {
      tasks = tasks.filter((t) => t.projectId === filters.projectId);
    }

    if (filters?.status && filters.status !== 'ALL') {
      tasks = tasks.filter((t) => t.status === filters.status);
    }

    if (filters?.priority && filters.priority !== 'ALL') {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }

    if (filters?.assigneeId && filters.assigneeId !== 'ALL') {
      tasks = tasks.filter((t) => t.assigneeId === filters.assigneeId);
    }

    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async findById(id: string): Promise<Task | undefined> {
    const db = getDatabase();
    return db.tasks.find((t) => t.id === id);
  }

  async create(
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
    if (creator.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can create new tasks');
    }

    const db = getDatabase();
    const newTask: Task = {
      id: `task-${crypto.randomUUID()}`,
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      status: data.status || 'TODO',
      priority: data.priority || 'MEDIUM',
      assigneeId: data.assigneeId || '',
      createdById: creator.id,
      dueDate: data.dueDate,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.tasks.unshift(newTask);
    saveDbToFile(db);
    return newTask;
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        Task,
        'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'dueDate' | 'tags'
      >
    >,
    user: User,
  ): Promise<Task> {
    const db = getDatabase();
    const taskIndex = db.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }
    const task = db.tasks[taskIndex];

    if (user.role !== 'ADMIN') {
      if (task.assigneeId !== user.id) {
        throw new Error('Unauthorized: Members can only update tasks assigned to them');
      }
      if (
        (data.title !== undefined && data.title !== task.title) ||
        (data.description !== undefined && data.description !== task.description) ||
        (data.priority !== undefined && data.priority !== task.priority) ||
        (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId)
      ) {
        throw new Error('Unauthorized: Members can only update task status');
      }
    }

    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.status !== undefined) task.status = data.status;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.assigneeId !== undefined) task.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) task.dueDate = data.dueDate;
    if (data.tags !== undefined) task.tags = data.tags;
    task.updatedAt = new Date().toISOString();

    saveDbToFile(db);
    return task;
  }

  async delete(id: string, user: User): Promise<boolean> {
    if (user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can delete tasks');
    }

    const db = getDatabase();
    const taskIndex = db.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) return false;

    db.tasks.splice(taskIndex, 1);
    saveDbToFile(db);
    return true;
  }
}

export const taskRepository = new TaskRepository();
