import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DealPerformanceOverviewQueryDto } from './dto/deal-performance-overview-query.dto';
import { DealPerformanceDashboardService } from './deal-performance-dashboard.service';

// Consultants are deliberately excluded from this dashboard in Phase 9a —
// they already have their own personal ConsultantDashboardView; this page's
// widgets (cross-consultant leaderboards, store-wide breakdowns) aren't
// naturally "my data only" without redesigning every widget's scope.
@UseGuards(JwtAuthGuard)
@Controller('crm/deal-performance')
export class DealPerformanceDashboardController {
  constructor(private dealPerformanceDashboardService: DealPerformanceDashboardService) {}

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  overview(@CurrentUser() user: JwtPayload, @Query() query: DealPerformanceOverviewQueryDto) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.dealPerformanceDashboardService.getOverview(user.organizationId, query, storeConstraint);
  }
}
