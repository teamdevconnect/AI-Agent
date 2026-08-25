import { IsOptional, IsString } from 'class-validator';

// Shared nested DTO for Create/UpdateInvoiceDto — mirrors
// InvoiceClientDetails's schema shape exactly.
export class InvoiceClientDetailsDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
