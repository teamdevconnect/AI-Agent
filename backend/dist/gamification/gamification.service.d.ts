import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
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
    constructor(statsModel: Model<UserStatsDocument>, notificationsService: NotificationsService);
    getStats(userId: string): Promise<UserStatsOut>;
    recordTaskCompletion(userId: string, wasOverdue: boolean): Promise<{
        newAchievements: Achievement[];
    }>;
}
