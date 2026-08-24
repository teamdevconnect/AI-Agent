import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { UsersService } from './users.service';

// Cross-org platform_admin management — deliberately separate from
// UsersController (which is org-scoped @Roles('admin') and can never see or
// touch another organization's users). Matches billing-admin.controller.ts's
// gate exactly: this is Haive-internal, never reachable by an org's own
// admin/owner.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('users/admin/platform-admins')
export class AdminUsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  list(@Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.usersService.listPlatformAdmins({
      search,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  // Backs the "grant to..." lookup — finding a candidate to promote is not
  // limited to users who are already platform_admin.
  @Get('search-candidates')
  searchCandidates(@Query('search') search: string) {
    if (!search || search.trim().length < 2) return [];
    return this.usersService.searchAllUsers(search.trim());
  }

  @Post(':userId/grant')
  grant(@Param('userId') userId: string) {
    return this.usersService.grantPlatformAdmin(userId);
  }

  @Post(':userId/revoke')
  revoke(@Param('userId') userId: string, @CurrentUser() caller: JwtPayload) {
    return this.usersService.revokePlatformAdmin(userId, caller.sub);
  }
}
