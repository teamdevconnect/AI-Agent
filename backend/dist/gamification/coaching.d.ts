interface CoachingStats {
    tasksCompleted: number;
    currentStreak: number;
    unlockedAchievements: string[];
}
export declare function coachingMessage(stats: CoachingStats): string;
export {};
