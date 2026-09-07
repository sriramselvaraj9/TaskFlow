import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser } from '@/lib/authHelper';
import { deleteProject, getProjectById, updateProject } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  const currentUser = await getAuthenticatedUser(req, res);

  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
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
