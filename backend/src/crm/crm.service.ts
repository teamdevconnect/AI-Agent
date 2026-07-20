import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Stub CRM client. Swap the placeholder returns for real HTTP calls to
 * CRM_BASE_URL once credentials are available — the shape of each method
 * is the contract the frontend dashboard and the agent's crm_tool rely on.
 */
@Injectable()
export class CrmService {
  constructor(private config: ConfigService) {}

  private get configured(): boolean {
    return Boolean(this.config.get<string>('integrations.crm.baseUrl'));
  }

  async getLeads() {
    if (!this.configured) return this.placeholderLeads();
    // TODO: axios GET `${baseUrl}/leads` with CRM_API_KEY
    return this.placeholderLeads();
  }

  async getCustomers() {
    return [];
  }

  async getOpportunities() {
    return [];
  }

  private placeholderLeads() {
    return [
      { id: 'lead-1', name: 'Acme Corp', stage: 'new', createdAt: new Date().toISOString() },
      { id: 'lead-2', name: 'Globex Inc', stage: 'contacted', createdAt: new Date().toISOString() },
    ];
  }
}
