import { IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Hand-written rather than `PartialType(CreateVendorQuoteDto)` — this repo
// has no @nestjs/mapped-types dependency (see update-deal.dto.ts's own
// comment). vendorId is intentionally excluded — a vendor quote never
// changes which vendor it belongs to; delete and recreate instead.
export class UpdateVendorQuoteDto {
  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  quoteId?: string;

  @IsOptional()
  @IsString()
  vendorReferenceNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quotedAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Matches(DATE, { message: 'quoteDate must be YYYY-MM-DD' })
  quoteDate?: string;

  @IsOptional()
  @Matches(DATE, { message: 'validUntil must be YYYY-MM-DD' })
  validUntil?: string;

  @IsOptional()
  @IsIn(['pending', 'accepted', 'rejected', 'expired'])
  status?: 'pending' | 'accepted' | 'rejected' | 'expired';
}
