import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

class AgentRoleKpiDto {
  @IsString() name: string;
  @IsString() description: string;
}

export class UpdateAgentRoleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) responsibilities?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) dailyTasks?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) weeklyTasks?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentRoleKpiDto)
  kpis?: AgentRoleKpiDto[];

  @IsOptional() @IsString() systemPrompt?: string;
  @IsOptional() @IsIn(['draft', 'active']) status?: 'draft' | 'active';
}
