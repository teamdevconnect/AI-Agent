import { IsOptional, IsString } from 'class-validator';

export class GetOverviewQueryDto {
  @IsOptional()
  @IsString()
  agentId?: string;
}
