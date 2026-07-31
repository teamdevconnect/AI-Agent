import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { TimelineService } from '../timeline/timeline.service';
import { Achievement } from './achievements';
import { UserStatsDocument } from './schemas/user-stats.schema';
export interface UserStatsOut {
    userId: string;
    tasksCompleted: number;
    overdueCleared: number;
    points: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate?: string;
    unlockedAchievements: string[];
    coachingMessage: string;
}
export declare class GamificationService {
    private statsModel;
    private notificationsService;
    private timelineService;
    constructor(statsModel: Model<UserStatsDocument>, notificationsService: NotificationsService, timelineService: TimelineService);
    getStats(userId: string): Promise<UserStatsOut>;
    recordTaskCompletion(userId: string, organizationId: string, wasOverdue: boolean): Promise<{
        newAchievements: Achievement[];
    }>;
}
