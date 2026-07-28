export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_task', title: 'First Step', description: 'Complete your first task.' },
  { id: 'ten_tasks', title: 'Getting Things Done', description: 'Complete 10 tasks.' },
  { id: 'fifty_tasks', title: 'Task Master', description: 'Complete 50 tasks.' },
  { id: 'three_day_streak', title: 'Building Momentum', description: 'Complete at least one task 3 days in a row.' },
  { id: 'seven_day_streak', title: 'On a Roll', description: 'Complete at least one task 7 days in a row.' },
  { id: 'overdue_slayer', title: 'Overdue Slayer', description: 'Clear 5 overdue tasks.' },
];

/** Pure function: given stats AFTER a completion was recorded, which
 * achievement ids are newly met that weren't already unlocked? Kept
 * side-effect-free and separate from GamificationService so the unlock
 * rules are one readable list, not scattered through service logic. */
export function checkNewAchievements(stats: {
  tasksCompleted: number;
  currentStreak: number;
  overdueCleared: number;
  unlockedAchievements: string[];
}): Achievement[] {
  const already = new Set(stats.unlockedAchievements);
  const newlyMet: Achievement[] = [];

  const maybeUnlock = (id: string, met: boolean) => {
    if (met && !already.has(id)) {
      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
      if (achievement) newlyMet.push(achievement);
    }
  };

  maybeUnlock('first_task', stats.tasksCompleted >= 1);
  maybeUnlock('ten_tasks', stats.tasksCompleted >= 10);
  maybeUnlock('fifty_tasks', stats.tasksCompleted >= 50);
  maybeUnlock('three_day_streak', stats.currentStreak >= 3);
  maybeUnlock('seven_day_streak', stats.currentStreak >= 7);
  maybeUnlock('overdue_slayer', stats.overdueCleared >= 5);

  return newlyMet;
}
