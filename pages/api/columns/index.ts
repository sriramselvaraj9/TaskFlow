import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors, getAuthenticatedUser } from '@/lib/authHelper';
import { createColumn, getColumns } from '@/lib/db';
import { createColumnSchema } from '@/lib/validators';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyCors(req, res)) return;

  const currentUser = await getAuthenticatedUser(req, res);

  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
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
