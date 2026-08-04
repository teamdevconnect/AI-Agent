import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Fixed, small vocabularies enforced at this DTO layer, not the Deal schema
// (see deal.schema.ts's comment) — a new category later needs no migration.
export const LEAD_SOURCES = ['referral', 'website', 'cold_call', 'event', 'partner', 'social_media', 'advertisement', 'other'] as const;
export const CUSTOMER_TYPES = ['individual', 'business', 'government', 'other'] as const;
export const REGIONS = ['north', 'south', 'east', 'west', 'central', 'international', 'other'] as const;

// Query params arrive as a single comma-separated string for multi-select
// filters (simpler to round-trip through a saved preset's JSON blob and a
// single React Query key entry than repeated `?x=a&x=b` params).
function splitCsv({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as string[];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export class DealFilterQueryDto {
  // Matched against expectedClosingDate — the same period-attribution/
  // closed-date proxy already used throughout sales-analytics.service.ts
  // and business-dashboard.service.ts; this app has no separate "closed at"
  // timestamp.
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  ownerId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  storeId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(['open', 'won', 'lost'], { each: true })
  dealStatus?: ('open' | 'won' | 'lost')[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  stageId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(LEAD_SOURCES, { each: true })
  leadSource?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  product?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(CUSTOMER_TYPES, { each: true })
  customerType?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(REGIONS, { each: true })
  region?: string[];

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  valueMin?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  valueMax?: number;
}
