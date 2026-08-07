import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AuthType } from './auth-methods';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { ProviderRule } from './provider-rules';
import { IntegrationCredentialDocument } from './schemas/integration-credential.schema';
export interface IntegrationStatus {
    connected: boolean;
    authType?: AuthType;
    maskedKey?: string;
    baseUrl?: string;
}
export interface IntegrationSummary extends IntegrationStatus {
    provider: string;
    connectedAt?: Date;
}
export declare class IntegrationsService {
    private credentialModel;
    private encryption;
    private http;
    constructor(credentialModel: Model<IntegrationCredentialDocument>, encryption: EncryptionService, http: HttpService);
    connect(organizationId: string, provider: string, apiKey: string, baseUrl?: string): Promise<{
        connected: true;
        maskedKey: string;
        baseUrl?: string;
    }>;
    connectWithAuth(organizationId: string, provider: string, dto: ConnectIntegrationDto): Promise<{
        connected: true;
        authType: AuthType;
        baseUrl?: string;
    }>;
    connectFromDto(organizationId: string, provider: string, dto: ConnectIntegrationDto): Promise<{
        connected: true;
        maskedKey: string;
        baseUrl?: string;
    }> | Promise<{
        connected: true;
        authType: AuthType;
        baseUrl?: string;
    }>;
    status(organizationId: string, provider: string): Promise<IntegrationStatus>;
    listCustom(organizationId: string): Promise<IntegrationSummary[]>;
    disconnect(organizationId: string, provider: string): Promise<void>;
    testConnection(organizationId: string, provider: string, dto: TestConnectionDto): Promise<{
        ok: boolean;
        message: string;
    }>;
    private friendlyErrorMessage;
    getProviderRule(provider: string): ProviderRule;
    private assertAllowed;
    private mask;
}
