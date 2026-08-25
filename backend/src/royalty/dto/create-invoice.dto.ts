import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { InvoiceClientDetailsDto } from './invoice-client-details.dto';

// No source/invoiceNumber/invoiceStatus field — the server always sets
// source: 'manual', generates the sequential invoiceNumber, and defaults
// invoiceStatus to 'draft'. `value` sets BOTH originalValue and
// currentValue in the service, since they're equal at creation time.
export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  quoteId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceClientDetailsDto)
  clientDetails?: InvoiceClientDetailsDto;

  @IsOptional()
  @IsString()
  salespersonId?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
