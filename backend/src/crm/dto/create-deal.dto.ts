import { IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { CUSTOMER_TYPES, LEAD_SOURCES, REGIONS } from './deal-filter-query.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// lostReason/lostReasonSource are deliberately not accepted here yet — the
// schema field exists (Phase 9a) but its capture UI/AI-fallback land in
// Phase 9b. The global ValidationPipe's forbidNonWhitelisted rejects any
// client that tries to send them early.
export class CreateDealDto {
  @IsString()
  name: string;

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
}
