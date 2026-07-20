import { IsOptional, IsString, MinLength } from 'class-validator';

export class ConnectIntegrationDto {
  @IsString()
  @MinLength(10)
  apiKey: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;
}
