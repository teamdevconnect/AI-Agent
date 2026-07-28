import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';
export declare class StoreSettingsController {
    private storeSettingsService;
    constructor(storeSettingsService: StoreSettingsService);
    get(): Promise<import("./schemas/store-settings.schema").StoreSettingsDocument>;
    update(dto: UpdateStoreSettingsDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/store-settings.schema").StoreSettingsDocument, {}, {}> & import("./schemas/store-settings.schema").StoreSettings & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    runNow(type: string): Promise<{
        usersNotified: number;
        totalUsers: number;
    }>;
}
