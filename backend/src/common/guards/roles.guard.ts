import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // no @Roles() → unrestricted

    const user = context.switchToHttp().getRequest().user as JwtPayload | undefined;
    const userRoles = user?.roles ?? []; // null-safe — fail closed, never throw
    if (!required.some((r) => userRoles.includes(r))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
