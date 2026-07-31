import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { TriggerType } from './create-workflow-definition.dto';

const TRIGGER_TYPES = ['schedule', 'event', 'manual'] as const;

export class UpdateWorkflowDefinitionDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) workflowName?: string;
  @IsOptional() @IsIn(TRIGGER_TYPES) triggerType?: TriggerType;
  @IsOptional() @IsString() schedule?: string;
  @IsOptional() @IsString() eventType?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
