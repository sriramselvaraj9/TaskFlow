import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { createTask, getTasks, getUserById } from '@/lib/db';
import { createTaskFullSchema } from '@/lib/validators';
import type { TaskPriority, TaskStatus } from '@/types';
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
      const { projectId, status, priority, assigneeId, search } = req.query;

      const filters = {
        projectId: typeof projectId === 'string' ? projectId : undefined,
        status: typeof status === 'string' ? (status as TaskStatus | 'ALL') : 'ALL',
        priority: typeof priority === 'string' ? (priority as TaskPriority | 'ALL') : 'ALL',
        assigneeId: typeof assigneeId === 'string' ? assigneeId : 'ALL',
        search: typeof search === 'string' ? search : undefined,
      };

      const tasks = await getTasks(filters);
      return res.status(200).json(tasks);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || 'Failed to fetch tasks' });
    }
  }

  if (req.method === 'POST') {
    try {
      const validatedData = createTaskFullSchema.parse(req.body);
      const newTask = await createTask(validatedData, currentUser);
      return res.status(201).json(newTask);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation Error', errors: error.errors });
      }
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to create task' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
