import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { deleteTask, getTaskById, getUserById, updateTask } from '@/lib/db';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const currentUser = (await getUserById(session.user.id)) || {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role || 'MEMBER',
    designation: session.user.role === 'ADMIN' ? 'Lead Administrator' : 'Software Engineer',
    createdAt: new Date().toISOString(),
  };

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  const task = await getTaskById(id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(task);
  }

  if (req.method === 'PUT') {
    try {
      const updated = await updateTask(id, req.body, currentUser);
      return res.status(200).json(updated);
    } catch (error: any) {
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to update task' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const success = await deleteTask(id, currentUser);
      if (!success) return res.status(404).json({ message: 'Task not found' });
      return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error: any) {
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to delete task' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
