import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
<<<<<<< HEAD
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
=======
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationsService } from './integrations.service';

@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

<<<<<<< HEAD
  @Post(':provider/connect')
=======
  // Writes a shared, business-wide credential (see integration-credential.schema.ts
  // — one doc per provider, not per-user) — previously connectable/disconnectable
  // by any authenticated user regardless of role.
  @Post(':provider/connect')
  @UseGuards(RolesGuard)
  @Roles('admin')
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  connect(@Param('provider') provider: string, @Body() dto: ConnectIntegrationDto) {
    return this.integrationsService.connect(provider, dto.apiKey, dto.baseUrl);
  }

  @Get(':provider/status')
  status(@Param('provider') provider: string) {
    return this.integrationsService.status(provider);
  }

  @Delete(':provider')
<<<<<<< HEAD
=======
  @UseGuards(RolesGuard)
  @Roles('admin')
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  disconnect(@Param('provider') provider: string) {
    return this.integrationsService.disconnect(provider);
  }
}
