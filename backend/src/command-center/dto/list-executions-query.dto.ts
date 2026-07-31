import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListExecutionsQueryDto {
  @IsOptional()
  @IsIn(['llm', 'tool'])
  kind?: 'llm' | 'tool';

  @IsOptional()
  @IsIn(['anthropic', 'groq'])
  provider?: 'anthropic' | 'groq';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
