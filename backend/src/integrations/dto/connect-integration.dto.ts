import { IsIn, IsObject, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { AUTH_TYPES, AuthType } from '../auth-methods';

export class ConnectIntegrationDto {
  // Legacy path (unchanged): apiKey required, authType absent. Every
  // existing caller (anthropic/crm connect UI) keeps working exactly as
  // before — validated below only when authType is NOT present.
  @ValidateIf((dto: ConnectIntegrationDto) => !dto.authType)
  @IsString()
  @MinLength(10)
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  // New flexible path: set authType to switch from the legacy apiKey-only
  // shape to one of auth-methods.ts's AuthType styles, with `credentials`
  // carrying whichever fields that type needs (see requiredCredentialFields).
  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: AuthType;

  @ValidateIf((dto: ConnectIntegrationDto) => Boolean(dto.authType))
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  healthCheckPath?: string;
}
