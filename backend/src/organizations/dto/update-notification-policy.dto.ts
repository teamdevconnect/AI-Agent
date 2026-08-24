import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPolicyDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}
