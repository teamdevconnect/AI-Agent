import { Document, Types } from 'mongoose';
export type NotificationDocument = Notification & Document<Types.ObjectId>;
export declare const NOTIFICATION_KINDS: readonly ["system", "integration", "warning", "error"];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export declare class Notification {
    userId: string;
    kind: NotificationKind;
    title: string;
    description: string;
    read: boolean;
    source?: string;
}
export declare const NotificationSchema: import("mongoose").Schema<Notification, import("mongoose").Model<Notification, any, any, any, Document<unknown, any, Notification, any, {}> & Notification & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Notification, Document<unknown, {}, import("mongoose").FlatRecord<Notification>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Notification> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
