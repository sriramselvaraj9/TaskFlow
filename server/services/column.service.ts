import type { BoardColumn, User } from '@/types';
import { columnRepository } from '../repositories/column.repository';
import { activityService } from './activity.service';

export class ColumnService {
  async getColumns(): Promise<BoardColumn[]> {
    return columnRepository.findAll();
  }

  async createColumn(
    data: {
      title: string;
      dotColor?: string;
      accentColor?: string;
    },
    user: User,
  ): Promise<BoardColumn> {
    const column = await columnRepository.create(data, user);
    await activityService.logActivity(
      'COLUMN_CREATED',
      `added new column "${column.title}" to the board`,
      user,
    );
    return column;
  }

  async deleteColumn(
    id: string,
    user: User,
  ): Promise<{ success: boolean; movedTasksCount: number; deletedColumn: BoardColumn }> {
    const result = await columnRepository.delete(id, user);
    const details =
      result.movedTasksCount > 0
        ? `deleted column "${result.deletedColumn.title}" and moved ${result.movedTasksCount} task(s) to Backlog`
        : `deleted column "${result.deletedColumn.title}"`;

    await activityService.logActivity('COLUMN_DELETED', details, user);
    return result;
  }

  async reorderColumns(columnIds: string[], user: User): Promise<BoardColumn[]> {
    return columnRepository.reorder(columnIds, user);
  }
}

export const columnService = new ColumnService();
