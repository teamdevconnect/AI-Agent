import type { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push-subscribe.dto';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';
export declare class NotificationsController {
    private notificationsService;
    private webPushService;
    constructor(notificationsService: NotificationsService, webPushService: WebPushService);
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
    getPreferences(user: JwtPayload): Promise<{
        desktopPush: boolean;
        mobilePush: boolean;
        email: boolean;
        orgPolicy: {
            emailEnabled: boolean;
            pushEnabled: boolean;
        };
    }>;
    updatePreferences(user: JwtPayload, dto: UpdateNotificationPreferencesDto): Promise<{
        desktopPush: boolean;
        mobilePush: boolean;
        email: boolean;
        orgPolicy: {
            emailEnabled: boolean;
            pushEnabled: boolean;
        };
    }>;
    getVapidPublicKey(): {
        publicKey: string;
    };
    subscribePush(user: JwtPayload, dto: PushSubscribeDto, req: Request): Promise<{
        success: boolean;
    }>;
    unsubscribePush(user: JwtPayload, dto: PushUnsubscribeDto): Promise<{
        success: boolean;
    }>;
}
