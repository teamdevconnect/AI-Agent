import { IsOptional, IsString } from 'class-validator';

// Either field may be supplied — service-layer rejects if neither is (see
// TwoFactorService's own comment on why password OR a TOTP/backup code are
// both accepted rather than requiring one specific factor).
export class TwoFactorReauthDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  code?: string;
}
