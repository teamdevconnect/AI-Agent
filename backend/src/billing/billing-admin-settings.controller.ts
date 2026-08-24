import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingAdminSettingsService } from './billing-admin-settings.service';
import { UpdateBillingSettingsDto } from './dto/update-billing-settings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/settings')
export class BillingAdminSettingsController {
  constructor(private settingsService: BillingAdminSettingsService) {}

  @Get()
  get() {
    return this.settingsService.getSettings();
  }

  @Put()
  update(@Body() dto: UpdateBillingSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
