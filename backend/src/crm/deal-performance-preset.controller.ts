import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { UpsertDealPerformancePresetDto } from './dto/upsert-deal-performance-preset.dto';
import { DealPerformancePresetService } from './deal-performance-preset.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin', 'manager')
@Controller('crm/deal-performance/presets')
export class DealPerformancePresetController {
  constructor(private presetService: DealPerformancePresetService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.presetService.list(user.organizationId, user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: UpsertDealPerformancePresetDto) {
    return this.presetService.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpsertDealPerformancePresetDto) {
    return this.presetService.update(id, user.organizationId, user.sub, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.presetService.remove(id, user.organizationId, user.sub);
  }
}
