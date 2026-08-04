import { Model } from 'mongoose';
import { IntegrationCredentialDocument } from './schemas/integration-credential.schema';
export declare class IntegrationsService {
    private credentialModel;
    constructor(credentialModel: Model<IntegrationCredentialDocument>);
    connect(organizationId: string, provider: string, apiKey: string, baseUrl?: string): Promise<{
        connected: true;
        maskedKey: string;
        baseUrl?: string;
    }>;
    status(organizationId: string, provider: string): Promise<{
        connected: boolean;
        maskedKey?: string;
        baseUrl?: string;
    }>;
    disconnect(organizationId: string, provider: string): Promise<void>;
    private assertAllowed;
    private mask;
}
