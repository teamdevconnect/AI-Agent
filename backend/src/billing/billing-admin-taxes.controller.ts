import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingAdminTaxesService } from './billing-admin-taxes.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';

// Phase 1 catalog admin surface — platform_admin only, matching every other
// billing-admin-*.controller.ts's gate (global catalog, not one customer's
// data). Nothing here is reachable by a customer-scoped route yet.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/taxes')
export class BillingAdminTaxesController {
  constructor(private taxesService: BillingAdminTaxesService) {}

  @Get()
  list() {
    return this.taxesService.listTaxRates();
  }

  @Post()
  create(@Body() dto: CreateTaxRateDto) {
    return this.taxesService.createTaxRate(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.taxesService.updateTaxRate(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.taxesService.setActive(id, true);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.taxesService.setActive(id, false);
  }
}
