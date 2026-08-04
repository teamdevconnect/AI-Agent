import { Document, Types } from 'mongoose';
export type OutlookConnectionDocument = OutlookConnection & Document<Types.ObjectId>;
export declare class OutlookConnection {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string;
    isActive: boolean;
}
export declare const OutlookConnectionSchema: import("mongoose").Schema<OutlookConnection, import("mongoose").Model<OutlookConnection, any, any, any, Document<unknown, any, OutlookConnection, any, {}> & OutlookConnection & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, OutlookConnection, Document<unknown, {}, import("mongoose").FlatRecord<OutlookConnection>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<OutlookConnection> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
