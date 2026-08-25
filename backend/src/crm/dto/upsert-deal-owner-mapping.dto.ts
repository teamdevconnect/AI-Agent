import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertDealOwnerMappingDto {
  @IsString()
  @MinLength(1)
  provider: string;

  @IsString()
  @MinLength(1)
  externalOwnerRef: string;

  @IsOptional()
  @IsString()
  externalOwnerLabel?: string;

  @IsString()
  @MinLength(1)
  ownerId: string;
}
