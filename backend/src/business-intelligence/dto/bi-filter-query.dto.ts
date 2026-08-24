import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Query params arrive as a single comma-separated string for multi-select
// filters — same convention as deal-filter-query.dto.ts's own splitCsv.
export function splitCsv({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as string[];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Shared base every Business Intelligence section's own filter DTO extends —
// dateFrom/dateTo (absent means "current month", see resolveBiDateRange in
// bi-filter.util.ts) plus employeeId/storeId. storeId doubles as "Team" —
// the plan's own finding: no separate Team entity exists anywhere in this
// codebase, every "team" reference means "the manager's own store roster".
// Same "shared base + per-list extension" shape as DealFilterQueryDto/
// ListDealsQueryDto.
export class BiFilterQueryDto {
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
  employeeId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  storeId?: string[];
}
