import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  // Registering always creates a brand-new organization (with the caller as
  // its owner) — there's no invite-into-an-existing-org flow yet (that's a
  // Phase 2+ concern once org administration UI exists), so this is required
  // rather than optional.
  @IsString()
  @MinLength(1)
  organizationName: string;
}
