declare class AgentRoleKpiDto {
    name: string;
    description: string;
}
export declare class UpdateAgentRoleDto {
    name?: string;
    department?: string;
    description?: string;
    responsibilities?: string[];
    dailyTasks?: string[];
    weeklyTasks?: string[];
    kpis?: AgentRoleKpiDto[];
    systemPrompt?: string;
    status?: 'draft' | 'active';
    assignedDepartments?: string[];
    assignedUserIds?: string[];
    allowedTools?: string[];
    modelTier?: 'fast' | 'standard' | null;
}
export {};
