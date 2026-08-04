export interface Achievement {
    id: string;
    title: string;
    description: string;
}
export declare const ACHIEVEMENTS: Achievement[];
export declare function checkNewAchievements(stats: {
    tasksCompleted: number;
    currentStreak: number;
    overdueCleared: number;
    unlockedAchievements: string[];
}): Achievement[];
