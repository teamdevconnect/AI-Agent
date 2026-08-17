import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export class ManifestAuthDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() header_name?: string;
  @IsOptional() @IsString() value_template?: string;
  @IsOptional() @IsString() note?: string;
}

export class ManifestActionDto {
  @IsString() @MinLength(1) name: string;

  @IsIn(METHODS) method: (typeof METHODS)[number];

  // e.g. "/contact/upsert" — appended to the manifest's base_url as-is, no
  // reshaping. Any inaccuracy here (like an endpoint the manifest itself
  // flags as unverified) is the manifest author's to fix, before or after
  // import — this importer is an honest pass-through, never a validator.
  @IsString() @MinLength(1) path: string;

  @IsOptional() @IsString() description?: string;
}

export class ManifestModuleDto {
  @IsString() @MinLength(1) module: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestActionDto)
  actions: ManifestActionDto[];
}

// The manifest shape a connector-config JSON (base_url, an auth *template*,
// modules[].actions[]) is pasted in as — mirrors that format field-for-field
// so a real connector spec can be imported with no reshaping. The actual
// secret is deliberately NEVER part of this: apiKeyValue/username/password
// below are supplied separately by whoever is importing, so the manifest
// itself stays safe to copy/paste/share (matching how a real manifest's own
// `auth` block is only ever a template, never a filled-in key).
export class ImportConnectorManifestDto {
  @IsString() @MinLength(1) connector_id: string;

  @IsOptional() @IsString() display_name?: string;
  @IsOptional() @IsString() version?: string;

  @IsString() @MinLength(1) base_url: string;

  @ValidateNested()
  @Type(() => ManifestAuthDto)
  auth: ManifestAuthDto;

  @IsOptional() @IsString() test_connection_action?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestModuleDto)
  modules: ManifestModuleDto[];

  @IsOptional() @IsString() apiKeyValue?: string;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() password?: string;
}
