import { Document, Types } from 'mongoose';
export type StoreSettingsDocument = StoreSettings & Document<Types.ObjectId>;
export declare class StoreSettings {
    openingTime: string;
    closingTime: string;
    timezone: string;
    lastMorningRunDate?: string;
    lastEodRunDate?: string;
}
export declare const StoreSettingsSchema: import("mongoose").Schema<StoreSettings, import("mongoose").Model<StoreSettings, any, any, any, Document<unknown, any, StoreSettings, any, {}> & StoreSettings & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StoreSettings, Document<unknown, {}, import("mongoose").FlatRecord<StoreSettings>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<StoreSettings> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
