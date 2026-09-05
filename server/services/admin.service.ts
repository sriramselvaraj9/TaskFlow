import type { User } from '@/types';
import { projectRepository } from '../repositories/project.repository';
import { taskRepository } from '../repositories/task.repository';
import { userRepository } from '../repositories/user.repository';

export class AdminService {
  async getAllUsers(): Promise<User[]> {
    return userRepository.findAll();
  }

  async getAllUsersWithStats(): Promise<any[]> {
    const users = await userRepository.findAll();
    const projects = await projectRepository.findAll();
    const tasks = await taskRepository.findAll();

    return users.map((user) => {
      const assignedProjects = projects.filter((p) => p.memberIds?.includes(user.id));
      const assignedTasks = tasks.filter((t) => t.assigneeId === user.id);

      return {
        ...user,
        assignedProjectsCount: assignedProjects.length,
        assignedTasksCount: assignedTasks.length,
      };
    });
  }

  async provisionUser(data: {
    name: string;
    email: string;
    passwordAttempt: string;
    role?: 'ADMIN' | 'MEMBER';
  }): Promise<User> {
    return userRepository.create(data);
  }

  async deleteUser(id: string, adminUser: User): Promise<boolean> {
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can delete members');
    }
    if (adminUser.id === id) {
      throw new Error('You cannot delete your own account');
    }
    const targetUser = await userRepository.findById(id);
    if (!targetUser) {
      throw new Error('User not found');
    }

    const success = await userRepository.delete(id);
    if (success) {
      const { activityService } = await import('./activity.service');
      await activityService.logActivity(
        'MEMBER_ASSIGNED',
        `removed member "${targetUser.name}" (${targetUser.email})`,
        adminUser,
      );
    }
    return success;
  }
}

export const adminService = new AdminService();
