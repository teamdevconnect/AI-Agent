import { IsString, MinLength } from 'class-validator';

// Called by python-agent's service-JWT bridge before run_agent() is
// invoked — organizationId/userId come from the JWT, never the body.
export class ReserveCreditsDto {
  @IsString()
  @MinLength(1)
  requestId: string;

  @IsString()
  @MinLength(1)
  conversationId: string;
}
