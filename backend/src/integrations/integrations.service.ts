import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IntegrationCredential,
  IntegrationCredentialDocument,
} from './schemas/integration-credential.schema';

// Only providers with a real backend-side consumer belong here. Outlook has
// its own dedicated OAuth module (see ../outlook); Gmail has no credentials
// flow wired yet.
const ALLOWED_PROVIDERS = ['anthropic', 'crm'];

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(IntegrationCredential.name)
    private credentialModel: Model<IntegrationCredentialDocument>,
  ) {}

  async connect(
    organizationId: string,
    provider: string,
    apiKey: string,
    baseUrl?: string,
  ): Promise<{ connected: true; maskedKey: string; baseUrl?: string }> {
    this.assertAllowed(provider);
    await this.credentialModel.findOneAndUpdate(
      { organizationId, provider },
      { organizationId, provider, apiKey, baseUrl },
      { upsert: true },
    );
    return { connected: true, maskedKey: this.mask(apiKey), baseUrl };
  }

  async status(organizationId: string, provider: string): Promise<{ connected: boolean; maskedKey?: string; baseUrl?: string }> {
    this.assertAllowed(provider);
    const doc = await this.credentialModel.findOne({ organizationId, provider });
    if (!doc) return { connected: false };
    return { connected: true, maskedKey: this.mask(doc.apiKey), baseUrl: doc.baseUrl };
  }

  async disconnect(organizationId: string, provider: string): Promise<void> {
    this.assertAllowed(provider);
    await this.credentialModel.deleteOne({ organizationId, provider });
  }

  private assertAllowed(provider: string): void {
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Unknown integration provider: ${provider}`);
    }
  }

  private mask(apiKey: string): string {
    return apiKey.length > 12 ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '***';
  }
}
