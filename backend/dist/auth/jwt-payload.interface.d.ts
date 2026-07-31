export interface JwtPayload {
    sub: string;
    email: string;
    roles: string[];
    organizationId: string;
    storeId?: string;
    assignedAgentId?: string;
    department?: string;
}
