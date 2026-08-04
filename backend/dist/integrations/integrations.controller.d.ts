import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationsService } from './integrations.service';
export declare class IntegrationsController {
    private integrationsService;
    constructor(integrationsService: IntegrationsService);
    connect(user: JwtPayload, provider: string, dto: ConnectIntegrationDto): Promise<{
        connected: true;
        maskedKey: string;
        baseUrl?: string;
    }>;
    status(user: JwtPayload, provider: string): Promise<{
        connected: boolean;
        maskedKey?: string;
        baseUrl?: string;
    }>;
    disconnect(user: JwtPayload, provider: string): Promise<void>;
}
