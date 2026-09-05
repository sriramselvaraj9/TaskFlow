import type { ActivityAction, ActivityLog, User } from '@/types';
import { getDatabase, saveDbToFile } from '../data';

export class ActivityService {
  async getActivities(limit = 20): Promise<ActivityLog[]> {
    const db = getDatabase();
    return db.activities.slice(0, limit);
  }

  async logActivity(
    action: ActivityAction,
    details: string,
    user: User,
    projectId?: string,
    taskId?: string,
  ): Promise<ActivityLog> {
    const db = getDatabase();
    const activity: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      action,
      details,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      projectId,
      taskId,
      timestamp: new Date().toISOString(),
    };

    db.activities.unshift(activity);
    if (db.activities.length > 50) {
      db.activities = db.activities.slice(0, 50);
    }
    saveDbToFile(db);
    return activity;
  }
}

export const activityService = new ActivityService();
