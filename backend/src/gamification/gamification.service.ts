import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { Achievement, checkNewAchievements } from './achievements';
import { coachingMessage } from './coaching';
import { UserStats, UserStatsDocument } from './schemas/user-stats.schema';

const POINTS_PER_TASK = 10;
const POINTS_PER_OVERDUE_CLEARED = 15; // bonus on top of the base 10, for clearing a task that was overdue

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStamp(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

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

@Injectable()
export class GamificationService {
  constructor(
    @InjectModel(UserStats.name) private statsModel: Model<UserStatsDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async getStats(userId: string): Promise<UserStatsOut> {
    const stats = await this.statsModel.findOne({ userId }).lean().exec();
    const base = stats ?? {
      userId,
      tasksCompleted: 0,
      overdueCleared: 0,
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      unlockedAchievements: [] as string[],
    };
    return { ...base, coachingMessage: coachingMessage(base) };
  }

  /** Called once per genuine todo/in_progress -> done transition (see
   * TasksService.updateStatus, which only calls this when the task wasn't
   * already done — re-marking an already-done task must never double-count).
   * Awards points, updates the daily completion streak, and unlocks any
   * newly-met achievements — notifying the user for each one via the same
   * notification pipeline proactive AI workflows use (see app.workflows in
   * python-agent for the cross-service equivalent of this same pattern).
   */
  async recordTaskCompletion(userId: string, wasOverdue: boolean): Promise<{ newAchievements: Achievement[] }> {
    const today = todayStamp();
    const existing = await this.statsModel.findOne({ userId }).exec();

    const previousStreak = existing?.currentStreak ?? 0;
    const lastDate = existing?.lastCompletionDate;
    let newStreak: number;
    if (lastDate === today) {
      newStreak = previousStreak; // already completed something today — streak unchanged, not double-counted
    } else if (lastDate === yesterdayStamp()) {
      newStreak = previousStreak + 1;
    } else {
      newStreak = 1; // gap of 2+ days, or first-ever completion — streak (re)starts at 1
    }

    const tasksCompleted = (existing?.tasksCompleted ?? 0) + 1;
    const overdueCleared = (existing?.overdueCleared ?? 0) + (wasOverdue ? 1 : 0);
    const points = (existing?.points ?? 0) + POINTS_PER_TASK + (wasOverdue ? POINTS_PER_OVERDUE_CLEARED : 0);
    const longestStreak = Math.max(existing?.longestStreak ?? 0, newStreak);
    const unlockedAchievements = existing?.unlockedAchievements ?? [];

    const newAchievements = checkNewAchievements({ tasksCompleted, currentStreak: newStreak, overdueCleared, unlockedAchievements });
    const updatedAchievements = [...unlockedAchievements, ...newAchievements.map((a) => a.id)];

    await this.statsModel
      .updateOne(
        { userId },
        {
          $set: {
            tasksCompleted,
            overdueCleared,
            points,
            currentStreak: newStreak,
            longestStreak,
            lastCompletionDate: today,
            unlockedAchievements: updatedAchievements,
          },
        },
        { upsert: true },
      )
      .exec();

    for (const achievement of newAchievements) {
      await this.notificationsService.create(userId, {
        title: `Achievement unlocked: ${achievement.title}`,
        description: achievement.description,
        kind: 'system',
        source: 'gamification',
      });
    }

    return { newAchievements };
  }
}
