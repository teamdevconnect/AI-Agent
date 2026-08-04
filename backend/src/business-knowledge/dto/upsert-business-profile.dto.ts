import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class BusinessProfileFaqDto {
  @IsString() question: string;
  @IsString() answer: string;
}

// Hand-written, every field optional — a business profile is filled in
// incrementally, never all-at-once, same "no @nestjs/mapped-types" and
// "PATCH-shaped even though the route is PUT" convention as
// update-finance-document.dto.ts.
export class UpsertBusinessProfileDto {
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) branches?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) products?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) services?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) brands?: string[];

  @IsOptional() @IsString() pricingPolicies?: string;
  @IsOptional() @IsString() salesProcess?: string;
  @IsOptional() @IsString() customerJourney?: string;
  @IsOptional() @IsString() targetAudience?: string;

  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsString() mission?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) values?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessProfileFaqDto)
  faqs?: BusinessProfileFaqDto[];

  @IsOptional() @IsString() termsAndConditions?: string;
  @IsOptional() @IsString() warrantyPolicy?: string;
  @IsOptional() @IsString() refundPolicy?: string;
  @IsOptional() @IsString() shippingPolicy?: string;

  @IsOptional() @IsString() businessRules?: string;
  @IsOptional() @IsString() standardOperatingProcedures?: string;
  @IsOptional() @IsString() salesGuidelines?: string;
  @IsOptional() @IsString() marketingGuidelines?: string;
  @IsOptional() @IsString() internalPolicies?: string;
}
