import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingThemeService } from './billing-theme.service';
import { UpdateBillingThemeDto } from './dto/update-billing-theme.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/theme')
export class BillingAdminThemeController {
  constructor(private themeService: BillingThemeService) {}

  @Get()
  get() {
    return this.themeService.getTheme();
  }

  @Put()
  update(@Body() dto: UpdateBillingThemeDto) {
    return this.themeService.updateTheme(dto);
  }
}
