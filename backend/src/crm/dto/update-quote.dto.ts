import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Hand-written, not PartialType (this repo has no @nestjs/mapped-types
// dependency — see update-deal.dto.ts's own comment). quoteAmount/
// clientApprovalStatus/quoteStatus are all still editable at the DTO layer
// — the synced-quote guard that rejects them for externalId-bearing quotes
// lives in quotes.service.ts's updateQuote, not here, since a native
// (non-synced) quote must still be able to edit these same fields.
export class UpdateQuoteDto {
  @IsOptional()
  @IsString()
  quoteName?: string;

  @IsOptional()
  @IsString()
  quoteStatus?: string;

  @IsOptional()
  @IsString()
  clientApprovalStatus?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quoteAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Matches(DATE, { message: 'expirationDate must be YYYY-MM-DD' })
  expirationDate?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  requestNotes?: string;
}
