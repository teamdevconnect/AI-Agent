import { Document } from 'mongoose';
export type UserStatsDocument = UserStats & Document;
export declare class UserStats {
    userId: string;
    tasksCompleted: number;
    overdueCleared: number;
    points: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate?: string;
    unlockedAchievements: string[];
}
export declare const UserStatsSchema: import("mongoose").Schema<UserStats, import("mongoose").Model<UserStats, any, any, any, Document<unknown, any, UserStats, any, {}> & UserStats & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, UserStats, Document<unknown, {}, import("mongoose").FlatRecord<UserStats>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<UserStats> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
