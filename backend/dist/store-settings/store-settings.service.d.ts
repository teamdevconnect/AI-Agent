import { Model } from 'mongoose';
import { ChatService } from '../chat/chat.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { UsersService } from '../users/users.service';
import { StoreSettings, StoreSettingsDocument } from './schemas/store-settings.schema';
export declare class StoreSettingsService {
    private settingsModel;
    private chatService;
    private dashboardService;
    private usersService;
    private readonly logger;
    constructor(settingsModel: Model<StoreSettingsDocument>, chatService: ChatService, dashboardService: DashboardService, usersService: UsersService);
    getSettings(): Promise<StoreSettingsDocument>;
    updateSettings(patch: {
        openingTime?: string;
        closingTime?: string;
        timezone?: string;
    }): Promise<import("mongoose").Document<unknown, {}, StoreSettingsDocument, {}, {}> & StoreSettings & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    runNow(type: 'morning' | 'eod'): Promise<{
        usersNotified: number;
        totalUsers: number;
    }>;
    checkAndRunDailyJobs(): Promise<void>;
    private getOrCreateSettings;
    private runForAllUsers;
}
