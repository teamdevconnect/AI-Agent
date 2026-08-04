import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ASSET_TYPES } from '../schemas/business-knowledge-document.schema';

// Hand-written, all fields optional — a human reviewing/correcting an
// AI-classified document, same convention as update-finance-document.dto.ts.
export class UpdateBusinessKnowledgeDocumentDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsIn(ASSET_TYPES) assetType?: (typeof ASSET_TYPES)[number];
  @IsOptional() @IsString({ each: true }) @IsArray() keyTopics?: string[];
  @IsOptional() @IsObject() extractedEntities?: Record<string, unknown>;
}
