import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

// Identifies the target by provider name + resource/endpoint key rather
// than raw ObjectIds — this is what both the browser and python-agent's
// integration_execute tool actually have on hand (a provider name and the
// keys from GET /integrations/capabilities), not database ids.
export class ExecuteEndpointDto {
  @IsString()
  @MinLength(1)
  provider: string;

  @IsString()
  @MinLength(1)
  resourceKey: string;

  @IsString()
  @MinLength(1)
  endpointKey: string;

  @IsOptional()
  @IsObject()
  pathParams?: Record<string, string>;

  @IsOptional()
  @IsObject()
  query?: Record<string, string>;

  @IsOptional()
  @IsObject()
  body?: unknown;
}
