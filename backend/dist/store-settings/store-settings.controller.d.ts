import { JwtPayload } from '../auth/jwt-payload.interface';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';
export declare class StoreSettingsController {
    private storeSettingsService;
    constructor(storeSettingsService: StoreSettingsService);
    get(user: JwtPayload): Promise<import("../organizations/schemas/store.schema").StoreDocument>;
    update(user: JwtPayload, dto: UpdateStoreSettingsDto): Promise<import("../organizations/schemas/store.schema").StoreDocument>;
    runNow(user: JwtPayload, type: string): Promise<{
        usersNotified: number;
        totalUsers: number;
    }>;
}
