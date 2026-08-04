"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coachingMessage = coachingMessage;
const achievements_1 = require("./achievements");
function coachingMessage(stats) {
    if (stats.currentStreak >= 3) {
        return `${stats.currentStreak}-day streak! Keep it going — complete one task today to extend it.`;
    }
    if (stats.tasksCompleted === 0) {
        return 'Complete your first task today to get started.';
    }
    const nextTaskMilestone = [10, 50].find((n) => n > stats.tasksCompleted);
    if (nextTaskMilestone) {
        const remaining = nextTaskMilestone - stats.tasksCompleted;
        return `${remaining} more task${remaining === 1 ? '' : 's'} to reach ${nextTaskMilestone} completed.`;
    }
    const locked = achievements_1.ACHIEVEMENTS.filter((a) => !stats.unlockedAchievements.includes(a.id));
    if (locked.length > 0) {
        return `Next up: "${locked[0].title}" — ${locked[0].description}`;
    }
    return `${stats.tasksCompleted} tasks completed. Nice work — keep the momentum going.`;
}
//# sourceMappingURL=coaching.js.map