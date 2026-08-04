import { Model } from 'mongoose';
import { AgentRoleDocument } from '../agent-roles/schemas/agent-role.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
export declare class UsersService {
    private userModel;
    private agentRoleModel;
    constructor(userModel: Model<UserDocument>, agentRoleModel: Model<AgentRoleDocument>);
    findByEmail(email: string): Promise<(import("mongoose").Document<unknown, {}, UserDocument, {}, {}> & User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    findById(id: string): Promise<(import("mongoose").Document<unknown, {}, UserDocument, {}, {}> & User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    findIdsByOrgAndStore(organizationId: string, storeId: string): Promise<string[]>;
    findAll(organizationId: string): Promise<UserDocument[]>;
    create(data: {
        email: string;
        passwordHash: string;
        name: string;
        organizationId: string;
        storeId?: string;
        roles?: string[];
    }): Promise<import("mongoose").Document<unknown, {}, UserDocument, {}, {}> & User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    createByAdmin(dto: CreateUserDto, organizationId: string): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            organizationId: string;
            storeId: string | undefined;
            roles: string[];
            assignedAgentId: string | undefined;
            department: string | undefined;
            active: boolean;
        };
        tempPassword: string;
    }>;
    updateByAdmin(id: string, dto: UpdateUserDto, organizationId: string): Promise<{
        id: string;
        email: string;
        name: string;
        organizationId: string;
        storeId: string | undefined;
        roles: string[];
        assignedAgentId: string | undefined;
        department: string | undefined;
        active: boolean;
    }>;
    deleteByAdmin(id: string, organizationId: string): Promise<void>;
    toPublic(user: UserDocument): {
        id: string;
        email: string;
        name: string;
        organizationId: string;
        storeId: string | undefined;
        roles: string[];
        assignedAgentId: string | undefined;
        department: string | undefined;
        active: boolean;
    };
    private resolveValidAgentIds;
}
