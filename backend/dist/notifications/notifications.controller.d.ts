import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private notificationsService;
    constructor(notificationsService: NotificationsService);
    list(user: JwtPayload): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/notification.schema").NotificationDocument, {}, {}> & import("./schemas/notification.schema").Notification & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    create(user: JwtPayload, dto: CreateNotificationDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/notification.schema").NotificationDocument, {}, {}> & import("./schemas/notification.schema").Notification & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    markRead(user: JwtPayload, id: string): Promise<void>;
    markAllRead(user: JwtPayload): Promise<void>;
}
