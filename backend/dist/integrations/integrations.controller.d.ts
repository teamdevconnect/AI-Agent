import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationsService } from './integrations.service';
export declare class IntegrationsController {
    private integrationsService;
    constructor(integrationsService: IntegrationsService);
    connect(provider: string, dto: ConnectIntegrationDto): Promise<{
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
}
