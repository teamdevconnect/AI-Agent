import { Model } from 'mongoose';
import { ChatGateway } from '../chat/chat.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification, NotificationDocument } from './schemas/notification.schema';
export declare class NotificationsService {
    private notificationModel;
    private chatGateway;
    constructor(notificationModel: Model<NotificationDocument>, chatGateway: ChatGateway);
    create(userId: string, dto: CreateNotificationDto): Promise<import("mongoose").Document<unknown, {}, NotificationDocument, {}, {}> & Notification & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    list(userId: string): Promise<(import("mongoose").Document<unknown, {}, NotificationDocument, {}, {}> & Notification & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    markRead(userId: string, id: string): Promise<void>;
    markAllRead(userId: string): Promise<void>;
}
