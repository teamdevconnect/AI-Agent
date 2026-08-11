import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { CreateResourceDto } from './dto/create-resource.dto';
import { IntegrationsService } from './integrations.service';
import { IntegrationEndpoint, IntegrationEndpointDocument } from './schemas/integration-endpoint.schema';
import { IntegrationResource, IntegrationResourceDocument } from './schemas/integration-resource.schema';

export interface CapabilityEndpoint {
  key: string;
  name: string;
  method: string;
  path: string;
  description?: string;
}

export interface CapabilityResource {
  key: string;
  name: string;
  description?: string;
  endpoints: CapabilityEndpoint[];
}

export interface ProviderCapabilities {
  provider: string;
  resources: CapabilityResource[];
}

// CRUD for the resource/endpoint metadata the Dynamic Executor
// (dynamic-executor.service.ts) runs against, plus the read-only
// capabilities listing the AI's integration_capabilities tool consumes.
// Deliberately separate from IntegrationsService (which owns the
// credential/auth side) and DynamicExecutorService (which owns actually
// calling out) — this only owns the metadata admins configure.
@Injectable()
export class IntegrationResourcesService {
  constructor(
    @InjectModel(IntegrationResource.name) private resourceModel: Model<IntegrationResourceDocument>,
    @InjectModel(IntegrationEndpoint.name) private endpointModel: Model<IntegrationEndpointDocument>,
    private integrationsService: IntegrationsService,
  ) {}

  private async requireIntegration(organizationId: string, provider: string) {
    const auth = await this.integrationsService.resolveAuth(organizationId, provider);
    if (!auth) throw new NotFoundException(`No integration connected for provider "${provider}".`);
    return auth;
  }

  async listResources(organizationId: string, provider: string) {
    const auth = await this.requireIntegration(organizationId, provider);
    return this.resourceModel.find({ integrationId: auth.integrationId }).sort({ createdAt: 1 });
  }

  async createResource(organizationId: string, provider: string, dto: CreateResourceDto) {
    const auth = await this.requireIntegration(organizationId, provider);
    return this.resourceModel.create({
      organizationId,
      integrationId: auth.integrationId,
      name: dto.name,
      key: dto.key,
      description: dto.description,
    });
  }

  async deleteResource(organizationId: string, provider: string, resourceKey: string) {
    const auth = await this.requireIntegration(organizationId, provider);
    const resource = await this.resourceModel.findOne({ integrationId: auth.integrationId, key: resourceKey });
    if (!resource) throw new NotFoundException(`Resource "${resourceKey}" not found.`);
    await this.endpointModel.deleteMany({ resourceId: resource._id });
    await this.resourceModel.deleteOne({ _id: resource._id });
  }

  private async requireResource(organizationId: string, provider: string, resourceKey: string) {
    const auth = await this.requireIntegration(organizationId, provider);
    const resource = await this.resourceModel.findOne({ integrationId: auth.integrationId, key: resourceKey });
    if (!resource) throw new NotFoundException(`Resource "${resourceKey}" not found.`);
    return { auth, resource };
  }

  async listEndpoints(organizationId: string, provider: string, resourceKey: string) {
    const { resource } = await this.requireResource(organizationId, provider, resourceKey);
    return this.endpointModel.find({ resourceId: resource._id }).sort({ createdAt: 1 });
  }

  async createEndpoint(organizationId: string, provider: string, resourceKey: string, dto: CreateEndpointDto) {
    const { auth, resource } = await this.requireResource(organizationId, provider, resourceKey);
    return this.endpointModel.create({
      organizationId,
      integrationId: auth.integrationId,
      resourceId: resource._id,
      ...dto,
    });
  }

  async deleteEndpoint(organizationId: string, provider: string, resourceKey: string, endpointKey: string) {
    const { resource } = await this.requireResource(organizationId, provider, resourceKey);
    const result = await this.endpointModel.deleteOne({ resourceId: resource._id, key: endpointKey });
    if (result.deletedCount === 0) throw new NotFoundException(`Endpoint "${endpointKey}" not found.`);
  }

  /** Everything connected for this org, with its resources/endpoints —
   * consumed by GET /integrations/capabilities (browser + the
   * integration_capabilities AI tool via python-agent's bridge). */
  async listCapabilities(organizationId: string, providerFilter?: string): Promise<ProviderCapabilities[]> {
    const connected = await this.integrationsService.listConnected(organizationId);
    const scoped = providerFilter ? connected.filter((c) => c.provider === providerFilter) : connected;
    if (scoped.length === 0) return [];

    const integrationIds = scoped.map((c) => c.integrationId);
    const resources = await this.resourceModel.find({ integrationId: { $in: integrationIds } });
    const resourceIds = resources.map((r) => r._id);
    const endpoints = await this.endpointModel.find({ resourceId: { $in: resourceIds } });

    return scoped
      .map(({ integrationId, provider }) => {
        const ownResources = resources.filter((r) => r.integrationId.equals(integrationId));
        return {
          provider,
          resources: ownResources.map((resource) => ({
            key: resource.key,
            name: resource.name,
            description: resource.description,
            endpoints: endpoints
              .filter((e) => e.resourceId.equals(resource._id))
              .map((e) => ({
                key: e.key,
                name: e.name,
                method: e.method,
                path: e.path,
                description: e.description,
              })),
          })),
        };
      })
      .filter((entry) => entry.resources.length > 0);
  }
}
