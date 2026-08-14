import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingAdminService } from './billing-admin.service';

// Haive-internal only — every route here requires the platform_admin role,
// a NEW role distinct from every existing 'admin'/'owner' check in this
// codebase (which are always scoped to a customer's own organization).
// platform_admin has no self-serve grant path; it's assigned manually in
// Mongo. This is the one place provider cost/revenue/margin data is ever
// returned by an API — never reachable from a customer-scoped route.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin')
export class BillingAdminController {
  constructor(private adminService: BillingAdminService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.adminService.getOverview(days ? Number.parseInt(days, 10) : undefined);
  }

  @Get('organizations')
  organizations(@Query('days') days?: string) {
    return this.adminService.getOrganizationBreakdown(days ? Number.parseInt(days, 10) : undefined);
  }

  @Get('transactions')
  transactions(@Query('organizationId') organizationId?: string, @Query('type') type?: string, @Query('limit') limit?: string) {
    return this.adminService.listTransactions({
      organizationId,
      type,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get('payments')
  payments(@Query('organizationId') organizationId?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    return this.adminService.listPayments({
      organizationId,
      status,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }
}
