import { IsOptional, IsString, Matches, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: 'isIanaTimezone', async: false })
class IsIanaTimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone name (e.g. "Asia/Kolkata")';
  }
}

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'openingTime must be in 24-hour HH:mm format' })
  openingTime?: string;

  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'closingTime must be in 24-hour HH:mm format' })
  closingTime?: string;

  @IsOptional()
  @IsString()
  @Validate(IsIanaTimezoneConstraint)
  timezone?: string;
}
