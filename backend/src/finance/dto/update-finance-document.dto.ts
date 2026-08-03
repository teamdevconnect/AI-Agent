import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from './finance-filter-query.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class TaxDetailsDto {
  @IsOptional() @IsNumber() gstAmount?: number;
  @IsOptional() @IsNumber() vatAmount?: number;
  @IsOptional() @IsNumber() taxRatePct?: number;
  @IsOptional() @IsString() taxType?: string;
}

class BankDetailsDto {
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() ifscOrSwift?: string;
  @IsOptional() @IsString() accountHolderName?: string;
}

// Hand-written, all fields optional — a human reviewing/correcting an
// AI-extracted document, same convention as update-deal.dto.ts (no
// @nestjs/mapped-types dependency exists in this repo).
export class UpdateFinanceDocumentDto {
  @IsOptional() @IsString() vendorName?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsString() poNumber?: string;
  @IsOptional() @Matches(DATE, { message: 'invoiceDate must be YYYY-MM-DD' }) invoiceDate?: string;
  @IsOptional() @Matches(DATE, { message: 'dueDate must be YYYY-MM-DD' }) dueDate?: string;
  @IsOptional() @Matches(DATE, { message: 'paymentDate must be YYYY-MM-DD' }) paymentDate?: string;
  @IsOptional() @IsNumber() @Min(0) paymentAmount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(0) taxAmount?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TaxDetailsDto)
  taxDetails?: TaxDetailsDto;

  @IsOptional() @IsNumber() @Min(0) deliveryCharges?: number;
  @IsOptional() isSubscriptionPayment?: boolean;
  @IsOptional() @IsString() subscriptionProvider?: string;
  @IsOptional() @IsNumber() @Min(0) subscriptionCharges?: number;
  @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails?: BankDetailsDto;

  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() costCenter?: string;
  @IsOptional() @IsIn(PAYMENT_STATUSES) paymentStatus?: (typeof PAYMENT_STATUSES)[number];
  @IsOptional() @IsString() expenseCategory?: string;
}
