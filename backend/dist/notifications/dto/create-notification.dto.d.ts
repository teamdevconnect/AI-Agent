import { NotificationKind } from '../schemas/notification.schema';
export declare class CreateNotificationDto {
    title: string;
    description: string;
    kind: NotificationKind;
    source?: string;
}
