import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { InvoiceClientDetailsDto } from './invoice-client-details.dto';
import { INVOICE_STATUSES } from './invoice-filter-query.dto';

// voidStatus/voidDate/voidReason are deliberately NOT accepted here — same
// "capture only on a dedicated action, never a generic field edit" idiom as
// UpdateDealDto excluding lostReasonSource. Use VoidInvoiceDto's route
// instead. `value`, when present, routes through InvoicesService.update's
// aggregation-pipeline revision path (shifts currentValue -> previousValue);
// when absent, a normal $set is used.
export class UpdateInvoiceDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

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

  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  invoiceStatus?: 'draft' | 'invoiced' | 'paid';
}
