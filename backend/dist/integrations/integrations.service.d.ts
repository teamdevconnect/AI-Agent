import { Model } from 'mongoose';
import { IntegrationCredentialDocument } from './schemas/integration-credential.schema';
export declare class IntegrationsService {
    private credentialModel;
    constructor(credentialModel: Model<IntegrationCredentialDocument>);
    connect(provider: string, apiKey: string, baseUrl?: string): Promise<{
        connected: true;
        maskedKey: string;
        baseUrl?: string;
    }>;
    status(provider: string): Promise<{
        connected: boolean;
        maskedKey?: string;
        baseUrl?: string;
    }>;
    disconnect(provider: string): Promise<void>;
    private assertAllowed;
    private mask;
}
