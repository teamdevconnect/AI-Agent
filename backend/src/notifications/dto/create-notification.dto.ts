import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_KINDS,
  NotificationEntityType,
  NotificationKind,
} from '../schemas/notification.schema';

export class CreateNotificationDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsIn(NOTIFICATION_KINDS)
  kind: NotificationKind;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(NOTIFICATION_ENTITY_TYPES)
  entityType?: NotificationEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;
}
