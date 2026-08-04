import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationsService } from './integrations.service';

@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  // Writes a per-org credential (see integration-credential.schema.ts — one
  // doc per (org, provider), not per-user) — previously connectable/
  // disconnectable by any authenticated user regardless of role.
  @Post(':provider/connect')
  @UseGuards(RolesGuard)
  @Roles('admin')
  connect(@CurrentUser() user: JwtPayload, @Param('provider') provider: string, @Body() dto: ConnectIntegrationDto) {
    return this.integrationsService.connect(user.organizationId, provider, dto.apiKey, dto.baseUrl);
  }

  @Get(':provider/status')
  status(@CurrentUser() user: JwtPayload, @Param('provider') provider: string) {
    return this.integrationsService.status(user.organizationId, provider);
  }

  @Delete(':provider')
  @UseGuards(RolesGuard)
  @Roles('admin')
  disconnect(@CurrentUser() user: JwtPayload, @Param('provider') provider: string) {
    return this.integrationsService.disconnect(user.organizationId, provider);
  }
}
