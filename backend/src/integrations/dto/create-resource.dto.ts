import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(KEY_PATTERN, { message: 'key must be lowercase alphanumeric (dashes/underscores allowed)' })
  key: string;

  @IsOptional()
  @IsString()
  description?: string;
}
