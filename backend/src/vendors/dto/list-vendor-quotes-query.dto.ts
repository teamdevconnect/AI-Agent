import { IsOptional, IsString } from 'class-validator';

export class ListVendorQuotesQueryDto {
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  quoteId?: string;
}
