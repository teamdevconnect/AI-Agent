import { IsString, MinLength } from 'class-validator';

// Shared body shape for /billing/settle and /billing/release.
export class RequestIdDto {
  @IsString()
  @MinLength(1)
  requestId: string;
}
