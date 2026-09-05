import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { deleteProject, getProjectById, getUserById, updateProject } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const currentUser = await getUserById(session.user.id);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid session user' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  const project = await getProjectById(id);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(project);
  }

  if (req.method === 'PUT') {
    try {
      const updated = await updateProject(id, req.body, currentUser);
      return res.status(200).json(updated);
    } catch (error: any) {
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to update project' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const success = await deleteProject(id, currentUser);
      if (!success) return res.status(404).json({ message: 'Project not found' });
      return res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error: any) {
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to delete project' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
