import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private storeSettingsService: StoreSettingsService) {}

  @Get()
  get() {
    return this.storeSettingsService.getSettings();
  }

  // Business-wide operating hours affect every user's scheduled reports —
  // previously reachable by any authenticated user regardless of role, same
  // gap class as agent-roles/integrations below.
  @Put()
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Body() dto: UpdateStoreSettingsDto) {
    return this.storeSettingsService.updateSettings(dto);
  }

  // Manual trigger for testing/ops — waiting for a real opening/closing
  // time to verify the scheduled job is impractical, so this is a real,
  // permanent hook, not a throwaway.
  @Post('run-now')
  @UseGuards(RolesGuard)
  @Roles('admin')
  runNow(@Query('type') type: string) {
    return this.storeSettingsService.runNow(type === 'eod' ? 'eod' : 'morning');
  }
}
