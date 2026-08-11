import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntegrationEndpointDocument = IntegrationEndpoint & Document<Types.ObjectId>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class EndpointQueryParam {
  @Prop({ required: true })
  name: string;

  @Prop({ default: false })
  required?: boolean;

  @Prop()
  description?: string;
}

export class EndpointStaticHeader {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  value: string;
}

// Stored, not yet walked (see plan's "Explicitly deferred" — full
// pagination-walking) — the Dynamic Executor passes this through as
// metadata for now; the AI tool can page manually via query/pathParams.
export class EndpointPagination {
  @Prop({ required: true, enum: ['none', 'pageSize', 'offsetLimit', 'cursor', 'linkHeader'], default: 'none' })
  style: 'none' | 'pageSize' | 'offsetLimit' | 'cursor' | 'linkHeader';

  @Prop()
  pageParam?: string;

  @Prop()
  sizeParam?: string;

  @Prop()
  cursorParam?: string;
}

// One arbitrary, admin-configured action against a connected integration —
// e.g. GET /leads/{id} or POST /leads/{id}/assign. This, not any
// provider-specific function, is what the Dynamic Executor
// (dynamic-executor.service.ts) actually runs: method + path template +
// this integration's stored auth (see IntegrationCredential) is enough to
// call any REST endpoint on any provider.
@Schema({ timestamps: true, collection: 'integration_endpoints' })
export class IntegrationEndpoint {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Denormalized from the parent resource so the executor's hot-path lookup
  // (by integrationId + resourceKey + endpointKey) needs no extra join.
  @Prop({ required: true, type: Types.ObjectId, index: true })
  integrationId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, index: true })
  resourceId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  method: HttpMethod;

  // Appended to the integration's baseUrl. May contain {param} tokens
  // substituted from the caller's pathParams at execute time, e.g.
  // "/leads/{id}/assign".
  @Prop({ required: true })
  path: string;

  @Prop({ type: [EndpointQueryParam], default: [] })
  queryParams?: EndpointQueryParam[];

  // Static headers this endpoint always sends, distinct from the
  // integration's auth headers (see auth-methods.ts) — auth headers win on
  // a name collision (decided explicitly in dynamic-executor.service.ts).
  @Prop({ type: [EndpointStaticHeader], default: [] })
  headers?: EndpointStaticHeader[];

  // Raw JSON Schema, stored as-is — informational/validation aid for the
  // builder UI and the AI tool's understanding of what body to send; the
  // executor does not itself validate against it.
  @Prop({ type: Object })
  requestBodySchema?: Record<string, unknown>;

  @Prop({ type: Object })
  responseSchema?: Record<string, unknown>;

  @Prop({ type: EndpointPagination })
  pagination?: EndpointPagination;

  @Prop()
  timeoutMs?: number;

  @Prop()
  description?: string;
}

export const IntegrationEndpointSchema = SchemaFactory.createForClass(IntegrationEndpoint);
IntegrationEndpointSchema.index({ resourceId: 1, key: 1 }, { unique: true });
IntegrationEndpointSchema.index({ integrationId: 1, resourceId: 1, key: 1 });
