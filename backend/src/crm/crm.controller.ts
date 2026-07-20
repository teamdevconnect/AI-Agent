import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CrmService } from './crm.service';

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Get('leads')
  getLeads() {
    return this.crmService.getLeads();
  }

  @Get('customers')
  getCustomers() {
    return this.crmService.getCustomers();
  }

  @Get('opportunities')
  getOpportunities() {
    return this.crmService.getOpportunities();
  }
}
