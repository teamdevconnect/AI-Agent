import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { BusinessDashboardService } from './business-dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('crm/dashboard')
export class BusinessDashboardController {
  constructor(private businessDashboardService: BusinessDashboardService) {}

  @Get('owner')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  ownerOverview(@CurrentUser() user: JwtPayload, @Query('period') period?: string) {
    return this.businessDashboardService.getOwnerOverview(user, period);
  }

  @Get('manager')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'owner')
  managerOverview(@CurrentUser() user: JwtPayload, @Query('storeId') storeId?: string, @Query('period') period?: string) {
    return this.businessDashboardService.getManagerOverview(user, storeId, period);
  }

  @Get('consultant')
  @UseGuards(RolesGuard)
  @Roles('consultant')
  consultantOverview(@CurrentUser() user: JwtPayload, @Query('period') period?: string) {
    return this.businessDashboardService.getConsultantOverview(user, period);
  }
}
