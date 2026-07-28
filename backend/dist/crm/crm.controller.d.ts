import { CrmService } from './crm.service';
export declare class CrmController {
    private crmService;
    constructor(crmService: CrmService);
    getLeads(): Promise<{
        id: string;
        name: string;
        stage: string;
        createdAt: string;
    }[]>;
    getCustomers(): Promise<never[]>;
    getOpportunities(): Promise<never[]>;
}
