import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { AUTH_TYPES, AuthType } from '../auth-methods';

// Deliberately all-optional, unlike ConnectIntegrationDto — an empty body
// means "re-test whatever's already saved" (see
// IntegrationsService.testConnection), which is the common case for the
// "re-check connection" button on an existing integration, not just the
// pre-save "Test Connection" step in the connect wizard.
export class TestConnectionDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: AuthType;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  healthCheckPath?: string;
}
