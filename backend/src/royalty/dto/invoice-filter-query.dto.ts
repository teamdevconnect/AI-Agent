import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const INVOICE_STATUSES = ['draft', 'invoiced', 'paid'] as const;

// Query params arrive as a single comma-separated string for multi-select
// filters — same convention as deal-filter-query.dto.ts's splitCsv.
function splitCsv({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as string[];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

// Deliberately designed to be directly reusable by the future Phase 20b
// report engine's Section 1/2/3 queries — date range + status + voidStatus
// are exactly what those sections filter on.
export class InvoiceFilterQueryDto {
  // Matched against invoiceDate — a real Date field, unlike Deal's own
  // string-based expectedClosingDate.
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
  storeId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  salespersonId?: string[];

  // Free-text match against clientDetails.companyName/contactName.
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(INVOICE_STATUSES, { each: true })
  invoiceStatus?: ('draft' | 'invoiced' | 'paid')[];

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  voidStatus?: boolean;

  @IsOptional()
  @IsIn(['auto_from_quote', 'manual'])
  source?: 'auto_from_quote' | 'manual';
}
