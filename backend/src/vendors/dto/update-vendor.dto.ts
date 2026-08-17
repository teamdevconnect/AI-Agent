import { IsEmail, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

// Hand-written rather than `PartialType(CreateVendorDto)` — this repo has no
// @nestjs/mapped-types dependency (see update-deal.dto.ts's own comment).
export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsObject()
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscOrSwift?: string;
    accountHolderName?: string;
  };

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  notes?: string;
}
