import { ConfigService } from '@nestjs/config';
export declare class CrmService {
    private config;
    constructor(config: ConfigService);
    private get configured();
    getLeads(): Promise<{
        id: string;
        name: string;
        stage: string;
        createdAt: string;
    }[]>;
    getCustomers(): Promise<never[]>;
    getOpportunities(): Promise<never[]>;
    private placeholderLeads;
}
