import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingAdminPackagesService } from './billing-admin-packages.service';
import { CreateCreditPackageDto } from './dto/create-credit-package.dto';
import { UpdateCreditPackageDto } from './dto/update-credit-package.dto';

// Admin-haive's "Credit Packages" page — platform_admin only, matching
// every other billing-admin-*.controller.ts's gate. This is the sole source
// of what the customer-facing "Add Credits" modal shows (GET
// /billing/packages); nothing here is reachable from a customer-scoped route.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/packages')
export class BillingAdminPackagesController {
  constructor(private packagesService: BillingAdminPackagesService) {}

  @Get()
  list() {
    return this.packagesService.listPackages();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.packagesService.getPackage(id);
  }

  @Post()
  create(@Body() dto: CreateCreditPackageDto) {
    return this.packagesService.createPackage(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCreditPackageDto) {
    return this.packagesService.updatePackage(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.packagesService.setActive(id, true);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.packagesService.setActive(id, false);
  }
}
