import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { assertPublicHttpUrl } from '../common/security/ssrf-guard';
import { buildAuthHeaders } from './auth-methods';
import { normalizeError, normalizeSuccess, NormalizedExecutionResult } from './error-normalizer';
import { IntegrationsService } from './integrations.service';
import { IntegrationEndpoint, IntegrationEndpointDocument } from './schemas/integration-endpoint.schema';
import { IntegrationResource, IntegrationResourceDocument } from './schemas/integration-resource.schema';

export interface ExecuteParams {
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

// The one generic executor every configured endpoint (any provider, any
// resource, any action) runs through — deliberately has no provider-specific
// branches. Given an integration's stored auth (IntegrationsService.
// resolveAuth) and an endpoint's stored method/path/schema
// (integration-endpoint.schema.ts), this is enough to call any REST API.
@Injectable()
export class DynamicExecutorService {
  constructor(
    @InjectModel(IntegrationResource.name) private resourceModel: Model<IntegrationResourceDocument>,
    @InjectModel(IntegrationEndpoint.name) private endpointModel: Model<IntegrationEndpointDocument>,
    private integrationsService: IntegrationsService,
    private http: HttpService,
  ) {}

  async execute(
    organizationId: string,
    provider: string,
    resourceKey: string,
    endpointKey: string,
    params: ExecuteParams,
  ): Promise<NormalizedExecutionResult> {
    const auth = await this.integrationsService.resolveAuth(organizationId, provider);
    if (!auth) throw new NotFoundException(`No integration connected for provider "${provider}".`);
    if (!auth.baseUrl) throw new BadRequestException(`Integration "${provider}" has no base URL configured.`);

    const resource = await this.resourceModel.findOne({ integrationId: auth.integrationId, key: resourceKey });
    if (!resource) throw new NotFoundException(`Resource "${resourceKey}" not found for "${provider}".`);

    const endpoint = await this.endpointModel.findOne({ resourceId: resource._id, key: endpointKey });
    if (!endpoint) {
      throw new NotFoundException(`Endpoint "${endpointKey}" not found under resource "${resourceKey}".`);
    }

    const path = this.fillPathTemplate(endpoint.path, params.pathParams ?? {});
    const url = `${auth.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    await assertPublicHttpUrl(url);

    const missingQuery = (endpoint.queryParams ?? [])
      .filter((q) => q.required && !(params.query ?? {})[q.name])
      .map((q) => q.name);
    if (missingQuery.length > 0) {
      throw new BadRequestException(`Missing required query param(s): ${missingQuery.join(', ')}`);
    }

    // Endpoint's static headers first, then this integration's auth headers
    // — auth headers win on a name collision, decided explicitly rather
    // than left to object-spread order accidentally.
    const staticHeaders = Object.fromEntries((endpoint.headers ?? []).map((h) => [h.name, h.value]));
    const authHeaders = buildAuthHeaders(auth.authType, auth.credentials);
    const headers = { ...staticHeaders, ...authHeaders };

    const integrationId = auth.integrationId.toString();
    const endpointId = (endpoint._id as { toString(): string }).toString();

    try {
      const response = await firstValueFrom(
        this.http.request({
          method: endpoint.method,
          url,
          headers,
          params: params.query,
          data: params.body,
          timeout: endpoint.timeoutMs ?? 15_000,
        }),
      );
      return normalizeSuccess(integrationId, endpointId, response.status, response.data);
    } catch (err) {
      return normalizeError(integrationId, endpointId, err);
    }
  }

  private fillPathTemplate(path: string, pathParams: Record<string, string>): string {
    return path.replace(/\{([^}]+)\}/g, (match, token: string) => {
      const value = pathParams[token];
      if (value === undefined) {
        throw new BadRequestException(`Missing required path param "${token}" for this endpoint.`);
      }
      return encodeURIComponent(value);
    });
  }
}
