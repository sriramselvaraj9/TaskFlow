import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { createColumn, getColumns, getUserById } from '@/lib/db';
import { createColumnSchema } from '@/lib/validators';
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
      const columns = await getColumns();
      return res.status(200).json(columns);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || 'Failed to fetch columns' });
    }
  }

  if (req.method === 'POST') {
    try {
      if (currentUser.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Unauthorized: Only Admins can add columns' });
      }

      const validatedData = createColumnSchema.parse(req.body);
      const newColumn = await createColumn(validatedData, currentUser);
      return res.status(201).json(newColumn);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation Error', errors: error.errors });
      }
      const statusCode = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(statusCode).json({ message: error.message || 'Failed to create column' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
