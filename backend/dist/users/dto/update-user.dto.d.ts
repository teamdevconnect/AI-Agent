export declare class UpdateUserDto {
    role?: 'admin' | 'agent_user' | 'user';
    assignedAgentId?: string;
    active?: boolean;
}
