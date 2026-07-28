export declare class CreateUserDto {
    email: string;
    name: string;
    role: 'admin' | 'agent_user' | 'user';
    assignedAgentId?: string;
}
