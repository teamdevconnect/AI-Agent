import { AuthType } from '../auth-methods';
export declare class ConnectIntegrationDto {
    apiKey?: string;
    baseUrl?: string;
    authType?: AuthType;
    credentials?: Record<string, unknown>;
    healthCheckPath?: string;
}
