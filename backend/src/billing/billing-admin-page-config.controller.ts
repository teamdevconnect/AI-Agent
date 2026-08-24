import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingPageConfigService } from './billing-page-config.service';
import { UpdateBillingPageConfigDto } from './dto/update-billing-page-config.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/page-config')
export class BillingAdminPageConfigController {
  constructor(private pageConfigService: BillingPageConfigService) {}

  @Get()
  get() {
    return this.pageConfigService.getPageConfig();
  }

  @Put()
  update(@Body() dto: UpdateBillingPageConfigDto) {
    return this.pageConfigService.updatePageConfig(dto);
  }
}
