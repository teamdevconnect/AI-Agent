import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const TRIGGER_TYPES = ['schedule', 'event', 'manual'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export class CreateWorkflowDefinitionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  workflowName: string;

  @IsIn(TRIGGER_TYPES)
  triggerType: TriggerType;

  @ValidateIf((o: CreateWorkflowDefinitionDto) => o.triggerType === 'schedule')
  @IsString()
  @MinLength(1)
  schedule?: string;

  @ValidateIf((o: CreateWorkflowDefinitionDto) => o.triggerType === 'event')
  @IsString()
  @MinLength(1)
  eventType?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
