import type { Project, User } from '@/types';
import { projectRepository } from '../repositories/project.repository';
import { activityService } from './activity.service';

export class ProjectService {
  async getProjects(userId?: string, role?: string): Promise<Project[]> {
    return projectRepository.findAll(userId, role);
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    return projectRepository.findById(id);
  }

  async createProject(
    data: {
      name: string;
      key?: string;
      description: string;
      memberIds?: string[];
    },
    user: User,
  ): Promise<Project> {
    const project = await projectRepository.create(
      {
        name: data.name,
        key: data.key || '',
        description: data.description,
        memberIds: data.memberIds || [],
      },
      user,
    );
    await activityService.logActivity(
      'PROJECT_CREATED',
      `created project "${project.name}" (${project.key})`,
      user,
      project.id,
    );
    return project;
  }

  async updateProject(
    id: string,
    data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'memberIds'>>,
    user: User,
  ): Promise<Project> {
    const updated = await projectRepository.update(id, data, user);
    await activityService.logActivity(
      'TASK_UPDATED',
      `updated settings for project "${updated.name}"`,
      user,
      updated.id,
    );
    return updated;
  }

  async deleteProject(id: string, user: User): Promise<boolean> {
    const project = await projectRepository.findById(id);
    const success = await projectRepository.delete(id, user);
    if (success && project) {
      await activityService.logActivity(
        'TASK_DELETED',
        `deleted project "${project.name}" and its tasks`,
        user,
      );
    }
    return success;
  }
}

export const projectService = new ProjectService();
