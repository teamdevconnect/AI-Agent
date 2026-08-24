import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  desktopPush?: boolean;

  @IsOptional()
  @IsBoolean()
  mobilePush?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;
}
