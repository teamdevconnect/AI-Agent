"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamificationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const notifications_service_1 = require("../notifications/notifications.service");
const timeline_service_1 = require("../timeline/timeline.service");
const achievements_1 = require("./achievements");
const coaching_1 = require("./coaching");
const user_stats_schema_1 = require("./schemas/user-stats.schema");
const POINTS_PER_TASK = 10;
const POINTS_PER_OVERDUE_CLEARED = 15;
function todayStamp() {
    return new Date().toISOString().slice(0, 10);
}
function yesterdayStamp() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}
let GamificationService = class GamificationService {
    constructor(statsModel, notificationsService, timelineService) {
        this.statsModel = statsModel;
        this.notificationsService = notificationsService;
        this.timelineService = timelineService;
    }
    async getStats(userId) {
        const stats = await this.statsModel.findOne({ userId }).lean().exec();
        const base = stats ?? {
            userId,
            tasksCompleted: 0,
            overdueCleared: 0,
            points: 0,
            currentStreak: 0,
            longestStreak: 0,
            unlockedAchievements: [],
        };
        return { ...base, coachingMessage: (0, coaching_1.coachingMessage)(base) };
    }
    async recordTaskCompletion(userId, organizationId, wasOverdue) {
        const today = todayStamp();
        const existing = await this.statsModel.findOne({ userId }).exec();
        const previousStreak = existing?.currentStreak ?? 0;
        const lastDate = existing?.lastCompletionDate;
        let newStreak;
        if (lastDate === today) {
            newStreak = previousStreak;
        }
        else if (lastDate === yesterdayStamp()) {
            newStreak = previousStreak + 1;
        }
        else {
            newStreak = 1;
        }
        const tasksCompleted = (existing?.tasksCompleted ?? 0) + 1;
        const overdueCleared = (existing?.overdueCleared ?? 0) + (wasOverdue ? 1 : 0);
        const points = (existing?.points ?? 0) + POINTS_PER_TASK + (wasOverdue ? POINTS_PER_OVERDUE_CLEARED : 0);
        const longestStreak = Math.max(existing?.longestStreak ?? 0, newStreak);
        const unlockedAchievements = existing?.unlockedAchievements ?? [];
        const newAchievements = (0, achievements_1.checkNewAchievements)({ tasksCompleted, currentStreak: newStreak, overdueCleared, unlockedAchievements });
        const updatedAchievements = [...unlockedAchievements, ...newAchievements.map((a) => a.id)];
        await this.statsModel
            .updateOne({ userId }, {
            $set: {
                tasksCompleted,
                overdueCleared,
                points,
                currentStreak: newStreak,
                longestStreak,
                lastCompletionDate: today,
                unlockedAchievements: updatedAchievements,
            },
        }, { upsert: true })
            .exec();
        for (const achievement of newAchievements) {
            await this.notificationsService.create(userId, {
                title: `Achievement unlocked: ${achievement.title}`,
                description: achievement.description,
                kind: 'system',
                source: 'gamification',
            }, organizationId);
            await this.timelineService
                .record({
                organizationId,
                userId,
                type: 'achievement_unlocked',
                title: `Achievement unlocked: ${achievement.title}`,
                description: achievement.description,
                sourceType: 'achievement',
                sourceId: achievement.id,
            })
                .catch(() => undefined);
        }
        return { newAchievements };
    }
};
exports.GamificationService = GamificationService;
exports.GamificationService = GamificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_stats_schema_1.UserStats.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        notifications_service_1.NotificationsService,
        timeline_service_1.TimelineService])
], GamificationService);
//# sourceMappingURL=gamification.service.js.map