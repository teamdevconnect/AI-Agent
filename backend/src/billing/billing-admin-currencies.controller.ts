import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingAdminCurrenciesService } from './billing-admin-currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

// Phase 1 catalog admin surface — platform_admin only, matching every other
// billing-admin-*.controller.ts's gate (global catalog, not one customer's
// data). Nothing here is reachable by a customer-scoped route yet.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/currencies')
export class BillingAdminCurrenciesController {
  constructor(private currenciesService: BillingAdminCurrenciesService) {}

  @Get()
  list() {
    return this.currenciesService.listCurrencies();
  }

  @Post()
  create(@Body() dto: CreateCurrencyDto) {
    return this.currenciesService.createCurrency(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currenciesService.updateCurrency(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.currenciesService.setActive(id, true);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.currenciesService.setActive(id, false);
  }
}
