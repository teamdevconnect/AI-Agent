import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTokensService } from '../../api-tokens/api-tokens.service';

// Branches on the bearer token's own prefix before delegating to Passport's
// JWT strategy — a 'pat_'-prefixed token is looked up and validated against
// the ApiToken collection instead of verified as a JWT. This is the
// minimal-blast-radius way to give every existing @UseGuards(JwtAuthGuard)
// call site (nearly every controller in the app) real Bearer-token support
// with zero controller-level changes: request.user ends up the same
// JwtPayload shape either way, so @CurrentUser()/RolesGuard/every handler
// downstream needs no changes to accept either credential type.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private apiTokensService: ApiTokensService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    const bearer = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (bearer?.startsWith('pat_')) {
      return this.authenticateApiToken(request, bearer);
    }
    return super.canActivate(context);
  }

  private async authenticateApiToken(request: { user?: unknown }, token: string): Promise<boolean> {
    const payload = await this.apiTokensService.authenticateToken(token);
    if (!payload) throw new UnauthorizedException();
    request.user = payload;
    return true;
  }
}
