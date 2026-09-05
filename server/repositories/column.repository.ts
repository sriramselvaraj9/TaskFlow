import type { BoardColumn, User } from '@/types';
import { getDatabase, saveDbToFile } from '../data';
import { getDefaultColumns } from '../database/seed';

export class ColumnRepository {
  async findAll(): Promise<BoardColumn[]> {
    const db = getDatabase();
    if (!Array.isArray(db.columns) || db.columns.length === 0) {
      db.columns = getDefaultColumns();
      saveDbToFile(db);
    }
    return [...db.columns].sort((a, b) => a.order - b.order);
  }

  async findById(id: string): Promise<BoardColumn | undefined> {
    const db = getDatabase();
    return db.columns?.find((c) => c.id === id);
  }

  async create(
    data: {
      title: string;
      dotColor?: string;
      accentColor?: string;
    },
    user: User,
  ): Promise<BoardColumn> {
    if (user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can add new columns');
    }

    const trimmedTitle = data.title.trim();
    if (!trimmedTitle) {
      throw new Error('Column title is required');
    }

    const db = getDatabase();
    if (!Array.isArray(db.columns)) {
      db.columns = getDefaultColumns();
    }

    // Generate unique ID
    const baseSlug = trimmedTitle
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20);
    let columnId = baseSlug || `COL_${Date.now()}`;

    // Ensure ID uniqueness
    let counter = 1;
    while (
      db.columns.some((c) => c.id === columnId) ||
      columnId === 'BACKLOG' ||
      columnId === 'ALL'
    ) {
      columnId = `${baseSlug}_${counter++}`;
    }

    const maxOrder = db.columns.reduce((max, c) => Math.max(max, c.order ?? 0), -1);

    const newColumn: BoardColumn = {
      id: columnId,
      title: trimmedTitle,
      dotColor: data.dotColor || 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]',
      accentColor: data.accentColor || 'border-slate-900',
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };

    db.columns.push(newColumn);
    saveDbToFile(db);
    return newColumn;
  }

  async delete(
    id: string,
    user: User,
  ): Promise<{ success: boolean; movedTasksCount: number; deletedColumn: BoardColumn }> {
    if (user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can delete columns');
    }

    const db = getDatabase();
    if (!Array.isArray(db.columns)) {
      db.columns = getDefaultColumns();
    }

    const colIndex = db.columns.findIndex((c) => c.id === id);
    if (colIndex === -1) {
      throw new Error('Column not found');
    }

    const deletedColumn = db.columns[colIndex];

    // Find and migrate all tasks in this column to 'BACKLOG'
    let movedTasksCount = 0;
    const now = new Date().toISOString();
    db.tasks.forEach((task) => {
      if (task.status === id) {
        task.status = 'BACKLOG';
        task.updatedAt = now;
        movedTasksCount++;
      }
    });

    // Remove column
    db.columns.splice(colIndex, 1);
    saveDbToFile(db);

    return {
      success: true,
      movedTasksCount,
      deletedColumn,
    };
  }

  async reorder(columnIds: string[], user: User): Promise<BoardColumn[]> {
    if (user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admins can reorder columns');
    }

    const db = getDatabase();
    if (!Array.isArray(db.columns)) {
      db.columns = getDefaultColumns();
    }

    columnIds.forEach((id, index) => {
      const col = db.columns.find((c) => c.id === id);
      if (col) {
        col.order = index;
      }
    });

    saveDbToFile(db);
    return [...db.columns].sort((a, b) => a.order - b.order);
  }
}

export const columnRepository = new ColumnRepository();
