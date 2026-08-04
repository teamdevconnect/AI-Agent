import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStoreDto } from './dto/create-store.dto';
import { OrganizationsService } from './organizations.service';

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findOrgById(user.organizationId);
  }

  @Get('stores')
  stores(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.listStores(user.organizationId);
  }

  // Additional stores beyond the one auto-created at signup — an
  // owner/admin action, same sensitivity class as the other business-wide
  // mutations (store-settings, integrations, agent-roles).
  @Post('stores')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createStore(@CurrentUser() user: JwtPayload, @Body() dto: CreateStoreDto) {
    return this.organizationsService.createStore(user.organizationId, dto);
  }
}
