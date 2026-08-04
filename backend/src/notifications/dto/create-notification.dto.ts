import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { NOTIFICATION_KINDS, NotificationKind } from '../schemas/notification.schema';

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
}
