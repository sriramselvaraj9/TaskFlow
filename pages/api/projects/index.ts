import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { createProject, getProjects, getUserById } from '@/lib/db';
import { projectSchema } from '@/lib/validators';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  const currentUser = await getUserById(session.user.id);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid session user' });
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
