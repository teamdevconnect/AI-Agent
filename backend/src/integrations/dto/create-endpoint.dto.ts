import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const PAGINATION_STYLES = ['none', 'pageSize', 'offsetLimit', 'cursor', 'linkHeader'] as const;

export class EndpointQueryParamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class EndpointStaticHeaderDto {
  @IsString()
  name: string;

  @IsString()
  value: string;
}

export class EndpointPaginationDto {
  @IsIn(PAGINATION_STYLES)
  style: (typeof PAGINATION_STYLES)[number];

  @IsOptional()
  @IsString()
  pageParam?: string;

  @IsOptional()
  @IsString()
  sizeParam?: string;

  @IsOptional()
  @IsString()
  cursorParam?: string;
}

export class CreateEndpointDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(KEY_PATTERN, { message: 'key must be lowercase alphanumeric (dashes/underscores allowed)' })
  key: string;

  @IsIn(METHODS)
  method: (typeof METHODS)[number];

  // e.g. "/leads/{id}/assign" — {param} tokens filled from execute()'s
  // pathParams.
  @IsString()
  @MinLength(1)
  path: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndpointQueryParamDto)
  queryParams?: EndpointQueryParamDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndpointStaticHeaderDto)
  headers?: EndpointStaticHeaderDto[];

  @IsOptional()
  @IsObject()
  requestBodySchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  responseSchema?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => EndpointPaginationDto)
  pagination?: EndpointPaginationDto;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
