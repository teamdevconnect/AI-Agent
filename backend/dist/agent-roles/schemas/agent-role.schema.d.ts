import { Document, Types } from 'mongoose';
export type AgentRoleDocument = AgentRole & Document<Types.ObjectId>;
export declare class AgentRoleKpi {
    name: string;
    description: string;
}
export declare class AgentRole {
    organizationId: string;
    slug: string;
    name: string;
    department: string;
    description: string;
    responsibilities: string[];
    dailyTasks: string[];
    weeklyTasks: string[];
    kpis: AgentRoleKpi[];
    systemPrompt: string;
    sourceDocumentName: string;
    sourceDocumentId: string;
    status: 'draft' | 'active';
    assignedDepartments: string[];
    assignedUserIds: string[];
    allowedTools: string[];
    modelTier?: 'fast' | 'standard';
    avatarColor: string;
    createdBy: string;
}
export declare const AgentRoleSchema: import("mongoose").Schema<AgentRole, import("mongoose").Model<AgentRole, any, any, any, Document<unknown, any, AgentRole, any, {}> & AgentRole & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentRole, Document<unknown, {}, import("mongoose").FlatRecord<AgentRole>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<AgentRole> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
