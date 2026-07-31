import { Document, Types } from 'mongoose';
export type UserDocument = User & Document<Types.ObjectId>;
export declare class User {
    email: string;
    passwordHash: string;
    name: string;
    organizationId: string;
    storeId?: string;
    roles: string[];
    assignedAgentId?: string;
    department?: string;
    active: boolean;
    preferences: Record<string, unknown>;
}
export declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User, any, {}> & User & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<User> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
