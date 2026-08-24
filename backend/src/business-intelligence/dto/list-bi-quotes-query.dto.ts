import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BiFilterQueryDto, splitCsv } from './bi-filter-query.dto';

export class ListBiQuotesQueryDto extends BiFilterQueryDto {
  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  clientApprovalStatus?: string[];

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
