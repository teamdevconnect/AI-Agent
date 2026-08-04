import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ASSET_TYPES } from '../schemas/business-knowledge-document.schema';

function splitCsv({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as string[];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export class BusinessKnowledgeDocumentFilterQueryDto {
  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(ASSET_TYPES, { each: true })
  assetType?: (typeof ASSET_TYPES)[number][];

  @IsOptional()
  @IsIn(['processing', 'completed', 'failed'])
  extractionStatus?: 'processing' | 'completed' | 'failed';

  @IsOptional()
  @IsIn(['needs_review', 'reviewed'])
  reviewStatus?: 'needs_review' | 'reviewed';

  // Simple regex match on title/originalFilename — full-text search stays
  // inside Qdrant, not Mongo, same division of labor as everywhere else in
  // this app.
  @IsOptional()
  @IsString()
  search?: string;
}
