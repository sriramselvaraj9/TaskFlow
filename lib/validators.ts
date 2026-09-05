import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const taskSchemaStep1 = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .min(3, 'Description must be at least 3 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  projectId: z.string().min(1, 'Please select a project'),
});

export const taskSchemaStep2 = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().optional().default(''),
  dueDate: z.string().min(1, 'Please select a due date'),
});

export const taskSchemaStep3 = z.object({
  tags: z.array(z.string()).default([]),
});

export const createTaskFullSchema = taskSchemaStep1
  .merge(taskSchemaStep2)
  .merge(taskSchemaStep3)
  .extend({
    status: z.string().min(1, 'Status is required').default('TODO'),
  });

export type CreateTaskFormData = z.infer<typeof createTaskFullSchema>;

export const updateTaskStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
});

export const createColumnSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Column name must be at least 2 characters')
    .max(30, 'Column name cannot exceed 30 characters'),
  dotColor: z.string().optional(),
  accentColor: z.string().optional(),
});

export type CreateColumnFormData = z.infer<typeof createColumnSchema>;

export const projectSchema = z.object({
  name: z
    .string()
    .min(3, 'Project name must be at least 3 characters')
    .max(60, 'Project name cannot exceed 60 characters'),
  key: z.string().optional().default(''),
  description: z
    .string()
    .min(5, 'Description must be at least 5 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  memberIds: z.array(z.string()).default([]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
