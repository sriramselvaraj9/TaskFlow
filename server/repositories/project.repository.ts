import type { Project, User } from '@/types';
import { getDatabase, saveDbToFile } from '../data';

export class ProjectRepository {
  async findAll(userId?: string, userRole?: string): Promise<Project[]> {
    const db = getDatabase();
    if (!userId || userRole === 'ADMIN') {
      return [...db.projects];
    }
    return db.projects.filter((p) => p.memberIds.includes(userId));
  }

  async findById(id: string): Promise<Project | undefined> {
    const db = getDatabase();
    return db.projects.find((p) => p.id === id);
  }

  async create(
    data: { name: string; key: string; description: string; memberIds: string[] },
    creator: User,
  ): Promise<Project> {
    if (creator.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can create projects');
    }

    const db = getDatabase();
    let finalKey = (data.key || '').trim().toUpperCase();
    if (!finalKey) {
      const words = data.name.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        finalKey = words
          .slice(0, 3)
          .map((w) => w[0])
          .join('')
          .toUpperCase();
      } else {
        finalKey = data.name.slice(0, 3).toUpperCase();
      }
      finalKey = finalKey.replace(/[^A-Z0-9]/g, '') || 'PRJ';
    }

    const newProject: Project = {
      id: `prj-${Date.now()}`,
      name: data.name,
      key: finalKey,
      description: data.description,
      status: 'ACTIVE',
      ownerId: creator.id,
      memberIds: Array.from(new Set([creator.id, ...(data.memberIds || [])])),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.projects.unshift(newProject);
    saveDbToFile(db);
    return newProject;
  }

  async update(
    id: string,
    data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'memberIds'>>,
    user: User,
  ): Promise<Project> {
    if (user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can edit project settings');
    }

    const db = getDatabase();
    const projectIndex = db.projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
      throw new Error('Project not found');
    }
    const project = db.projects[projectIndex];

    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    if (data.status !== undefined) project.status = data.status;
    if (data.memberIds !== undefined)
      project.memberIds = Array.from(new Set([project.ownerId, ...data.memberIds]));
    project.updatedAt = new Date().toISOString();

    saveDbToFile(db);
    return project;
  }

  async delete(id: string, user: User): Promise<boolean> {
    if (user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can delete projects');
    }

    const db = getDatabase();
    const projectIndex = db.projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) return false;

    db.projects.splice(projectIndex, 1);
    // Delete associated tasks
    db.tasks = db.tasks.filter((t) => t.projectId !== id);

    saveDbToFile(db);
    return true;
  }
}

export const projectRepository = new ProjectRepository();
