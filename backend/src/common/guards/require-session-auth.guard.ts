import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../auth/jwt-payload.interface';

// Stacked alongside JwtAuthGuard (never alone — this only reads
// request.user.authMethod, which JwtAuthGuard is what populates) on routes
// that manage security settings themselves: change-password, /auth/2fa/*,
// /sessions/*'s revoke actions, /api-tokens/* itself. A leaked or
// intentionally-scripted API token can act on business data (the literal
// requirement), but must never be able to mint more tokens, disable 2FA, or
// revoke sessions out from under the real user — same convention GitHub/
// GitLab personal access tokens already follow.
@Injectable()
export class RequireSessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (user?.authMethod === 'api_token') {
      throw new ForbiddenException('This action requires a full login session, not an API token');
    }
    return true;
  }
}
