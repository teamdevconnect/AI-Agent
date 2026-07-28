import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetTrendQueryDto {
  @IsString()
  agentId: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30])
  days: 7 | 30 = 7;
}
