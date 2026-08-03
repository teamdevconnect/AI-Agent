import { IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { CUSTOMER_TYPES, LEAD_SOURCES, REGIONS } from './deal-filter-query.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Hand-written rather than `PartialType(CreateDealDto)` — this repo has no
// @nestjs/mapped-types dependency, and every other DTO pair here (Assign/
// Upsert-style) is written out directly. lostReason is client-settable
// (Phase 11) but lostReasonSource deliberately is NOT — deals.service.ts
// always server-sets it to 'rep_reported' whenever a non-empty lostReason
// arrives here, reserving 'ai_inferred' exclusively for a future backend-
// only inference job. Never trust a client-supplied value for provenance.
export class UpdateDealDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  pipelineId?: string;

  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsIn(['open', 'won', 'lost'])
  dealStatus?: 'open' | 'won' | 'lost';

  @IsOptional()
  @IsNumber()
  @Min(0)
  monetaryValue?: number;

  @IsOptional()
  @Matches(DATE, { message: 'expectedClosingDate must be YYYY-MM-DD' })
  expectedClosingDate?: string;

  @IsOptional()
  @IsIn(LEAD_SOURCES)
  leadSource?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsIn(CUSTOMER_TYPES)
  customerType?: string;

  @IsOptional()
  @IsIn(REGIONS)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;
}
