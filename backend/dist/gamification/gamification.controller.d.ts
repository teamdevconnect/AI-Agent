import { JwtPayload } from '../auth/jwt-payload.interface';
import { GamificationService } from './gamification.service';
export declare class GamificationController {
    private gamificationService;
    constructor(gamificationService: GamificationService);
    getStats(user: JwtPayload): Promise<import("./gamification.service").UserStatsOut>;
    getAchievements(user: JwtPayload): Promise<{
        achievements: {
            unlocked: boolean;
            id: string;
            title: string;
            description: string;
        }[];
    }>;
}
