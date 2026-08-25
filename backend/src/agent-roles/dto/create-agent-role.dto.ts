import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

class AgentRoleKpiDto {
  @IsString() name: string;
  @IsString() description: string;
}

// Agent Builder Phase 1 — Manual and Template creation both post here
// (Template just pre-fills these fields client-side from a constant, no
// server-side concept of "template" exists). No file, no AI call — the
// admin writes everything directly, matching Describe/Documents' own
// review-before-save step but skipping generation entirely. organizationId/
// createdBy/slug/status/sourceDocument* are all server-derived, never
// client-supplied — same convention generateDraft() already follows.
export class CreateAgentRoleDto {
  @IsString() name: string;

  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) goals?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) responsibilities?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) dailyTasks?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) weeklyTasks?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentRoleKpiDto)
  kpis?: AgentRoleKpiDto[];

  @IsString() systemPrompt: string;

  @IsOptional() @IsArray() @IsString({ each: true }) assignedDepartments?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assignedUserIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedTools?: string[];

  @IsOptional() @IsIn(['fast', 'standard', null]) modelTier?: 'fast' | 'standard' | null;
}
