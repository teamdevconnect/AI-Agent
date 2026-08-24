import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  @Get('dashboard')
  dashboard(@Query('days') days?: string) {
    return this.adminService.getDashboard(days ? Number.parseInt(days, 10) : undefined);
  }

  @Get('analytics')
  analytics(@Query('days') days?: string) {
    return this.adminService.getAnalyticsTimeSeries(days ? Number.parseInt(days, 10) : undefined);
  }

  @Get('organizations')
  organizations(
    @Query('days') days?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'name' | 'createdAt' | 'revenueUsd' | 'userCount',
  ) {
    return this.adminService.getOrganizationBreakdown(days ? Number.parseInt(days, 10) : undefined, {
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      search,
      sortBy,
    });
  }

  @Get('organizations/:id')
  organizationDetail(@Param('id') id: string) {
    return this.adminService.getOrganizationDetail(id);
  }

  @Get('organizations/:id/users')
  organizationUsers(@Param('id') id: string) {
    return this.adminService.listOrganizationUsers(id);
  }

  @Get('subscription-metrics')
  subscriptionMetrics(@Query('days') days?: string) {
    return this.adminService.getSubscriptionMetrics(days ? Number.parseInt(days, 10) : undefined);
  }

  @Get('wallets')
  wallets(@Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.listWallets({
      search,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get('transactions')
  transactions(
    @Query('organizationId') organizationId?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
  ) {
    return this.adminService.listTransactions({
      organizationId,
      type,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      skip: skip ? Number.parseInt(skip, 10) : undefined,
      dateFrom,
      dateTo,
      minAmount: minAmount ? Number.parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? Number.parseFloat(maxAmount) : undefined,
    });
  }

  @Get('payments')
  payments(
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.listPayments({
      organizationId,
      status,
      provider,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      skip: skip ? Number.parseInt(skip, 10) : undefined,
      dateFrom,
      dateTo,
    });
  }
}
