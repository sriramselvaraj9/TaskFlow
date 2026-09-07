import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser } from '@/lib/authHelper';
import { createProject, getProjects } from '@/lib/db';
import { projectSchema } from '@/lib/validators';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  const currentUser = await getAuthenticatedUser(req, res);

  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  if (req.method === 'GET') {
    try {
      const projects = await getProjects(currentUser.id, currentUser.role);
      return res.status(200).json(projects);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || 'Failed to fetch projects' });
    }
  }

  if (req.method === 'POST') {
    try {
      const validatedData = projectSchema.parse(req.body);
      const newProject = await createProject(validatedData, currentUser);
      return res.status(201).json(newProject);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation Error', errors: error.errors });
      }
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to create project' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
