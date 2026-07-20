import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationsService } from './integrations.service';

@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Post(':provider/connect')
  connect(@Param('provider') provider: string, @Body() dto: ConnectIntegrationDto) {
    return this.integrationsService.connect(provider, dto.apiKey, dto.baseUrl);
  }

  @Get(':provider/status')
  status(@Param('provider') provider: string) {
    return this.integrationsService.status(provider);
  }

  @Delete(':provider')
  disconnect(@Param('provider') provider: string) {
    return this.integrationsService.disconnect(provider);
  }
}
