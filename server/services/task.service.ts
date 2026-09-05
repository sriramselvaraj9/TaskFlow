import type { DashboardStats, Task, TaskPriority, TaskStatus, User } from '@/types';
import { taskRepository } from '../repositories/task.repository';
import { activityService } from './activity.service';
import { projectService } from './project.service';

export class TaskService {
  async getTasks(filters?: {
    projectId?: string;
    status?: TaskStatus | 'ALL';
    priority?: TaskPriority | 'ALL';
    assigneeId?: string | 'ALL';
    search?: string;
  }): Promise<Task[]> {
    return taskRepository.findAll(filters);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return taskRepository.findById(id);
  }

  async createTask(
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
    user: User,
  ): Promise<Task> {
    const task = await taskRepository.create(data, user);
    await activityService.logActivity(
      'TASK_CREATED',
      `created task "${task.title}"`,
      user,
      task.projectId,
      task.id,
    );
    return task;
  }

  async updateTask(
    id: string,
    data: Partial<
      Pick<
        Task,
        'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'dueDate' | 'tags'
      >
    >,
    user: User,
  ): Promise<Task> {
    const original = await taskRepository.findById(id);
    const updated = await taskRepository.update(id, data, user);

    if (original && data.status && original.status !== data.status) {
      await activityService.logActivity(
        'TASK_STATUS_CHANGED',
        `moved task "${updated.title}" from ${original.status} to ${updated.status}`,
        user,
        updated.projectId,
        updated.id,
      );
    } else {
      await activityService.logActivity(
        'TASK_UPDATED',
        `updated details for task "${updated.title}"`,
        user,
        updated.projectId,
        updated.id,
      );
    }

    return updated;
  }

  async deleteTask(id: string, user: User): Promise<boolean> {
    const task = await taskRepository.findById(id);
    const success = await taskRepository.delete(id, user);
    if (success && task) {
      await activityService.logActivity(
        'TASK_DELETED',
        `deleted task "${task.title}"`,
        user,
        task.projectId,
      );
    }
    return success;
  }

  async getDashboardStats(userId?: string): Promise<DashboardStats> {
    const tasks = await taskRepository.findAll();
    const projects = await projectService.getProjects();

    const assignedToMe = userId
      ? tasks.filter((t) => t.assigneeId === userId && t.status !== 'DONE').length
      : 0;

    const nowMs = Date.now();
    const overdueTasks = tasks.filter((t) => {
      if (t.status === 'DONE') return false;
      const dueMs = new Date(t.dueDate).getTime();
      return dueMs < nowMs;
    });

    const statusCounts: Record<string, number> = {
      BACKLOG: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    tasks.forEach((t) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });

    const priorityCounts: Record<TaskPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    tasks.forEach((t) => {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    });

    const totalTasks = tasks.length;
    const completedTasks = statusCounts.DONE || 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks: statusCounts.IN_PROGRESS || 0,
      overdueTasks: overdueTasks.length,
      overdueCount: overdueTasks.length,
      assignedToMe,
      activeProjects: projects.length,
      completionRate,
      tasksByStatus: statusCounts,
      tasksByPriority: priorityCounts,
    };
  }
}

export const taskService = new TaskService();
