import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CustomerActivityService } from './customer-activity.service';

// RBAC matches the rest of the Deal Performance page (owner/admin/manager),
// same canOverride/storeConstraint pattern deals.controller.ts already uses
// — a manager is always forced to their own store, never a client-supplied one.
@UseGuards(JwtAuthGuard)
@Controller('crm/customer-activity')
export class CustomerActivityController {
  constructor(private customerActivityService: CustomerActivityService) {}

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  overview(@CurrentUser() user: JwtPayload, @Query('storeId') storeIdOverride?: string) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? storeIdOverride : user.storeId;
    return this.customerActivityService.getOverview(user, storeConstraint);
  }

  @Post('generate-summary')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  generateSummary(@CurrentUser() user: JwtPayload, @Body() body: { regenerate?: boolean }) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.customerActivityService.generateSummary(user, storeConstraint, body?.regenerate ?? false);
  }

  // Consultant-only, always self-scoped via the caller's own JWT — no
  // owner/admin override to view a specific consultant's feed (matches
  // GET /crm/dashboard/consultant's existing precedent).
  @Get('personal-overview')
  @UseGuards(RolesGuard)
  @Roles('consultant')
  personalOverview(@CurrentUser() user: JwtPayload) {
    return this.customerActivityService.getPersonalOverview(user);
  }

  @Post('generate-personal-summary')
  @UseGuards(RolesGuard)
  @Roles('consultant')
  generatePersonalSummary(@CurrentUser() user: JwtPayload, @Body() body: { regenerate?: boolean }) {
    return this.customerActivityService.generatePersonalSummary(user, body?.regenerate ?? false);
  }

  // Phase 14a relationship view — same RBAC/store-scoping pattern as
  // `overview` above. businessKey is a Deal.accountId or a normalized
  // heuristic/email-derived string (see customer-grouping.util.ts) — the
  // frontend must encodeURIComponent it since it can contain arbitrary
  // characters (spaces, "@", ":").
  @Get('relationships/:businessKey')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  relationships(@CurrentUser() user: JwtPayload, @Param('businessKey') businessKey: string, @Query('storeId') storeIdOverride?: string) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? storeIdOverride : user.storeId;
    return this.customerActivityService.getRelationshipView(user, businessKey, storeConstraint);
  }

  // Consultant-only, always self-scoped — mirrors personal-overview above.
  @Get('personal-relationships/:businessKey')
  @UseGuards(RolesGuard)
  @Roles('consultant')
  personalRelationships(@CurrentUser() user: JwtPayload, @Param('businessKey') businessKey: string) {
    return this.customerActivityService.getPersonalRelationshipView(user, businessKey);
  }
}
