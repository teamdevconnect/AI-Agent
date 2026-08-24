import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.auditService.list(user.organizationId);
  }

  // Platform-wide, unscoped by organization — Admin-haive's Audit Logs page.
  // Separate @Roles gate from the route above; @UseGuards/@Roles on a method
  // override the controller-level ones for this handler only.
  @Get('all')
  @Roles('platform_admin')
  listAll(@Query('userId') userId?: string, @Query('route') route?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auditService.listAll({
      userId,
      route,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }
}
