import { IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateVendorQuoteDto {
  @IsString()
  vendorId: string;

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

  @IsNumber()
  @Min(0)
  quotedAmount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @Matches(DATE, { message: 'quoteDate must be YYYY-MM-DD' })
  quoteDate: string;

  @IsOptional()
  @Matches(DATE, { message: 'validUntil must be YYYY-MM-DD' })
  validUntil?: string;

  @IsOptional()
  @IsIn(['pending', 'accepted', 'rejected', 'expired'])
  status?: 'pending' | 'accepted' | 'rejected' | 'expired';
}
