"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const integration_credential_schema_1 = require("./schemas/integration-credential.schema");
const ALLOWED_PROVIDERS = ['anthropic', 'crm'];
let IntegrationsService = class IntegrationsService {
    constructor(credentialModel) {
        this.credentialModel = credentialModel;
    }
    async connect(organizationId, provider, apiKey, baseUrl) {
        this.assertAllowed(provider);
        await this.credentialModel.findOneAndUpdate({ organizationId, provider }, { organizationId, provider, apiKey, baseUrl }, { upsert: true });
        return { connected: true, maskedKey: this.mask(apiKey), baseUrl };
    }
    async status(organizationId, provider) {
        this.assertAllowed(provider);
        const doc = await this.credentialModel.findOne({ organizationId, provider });
        if (!doc)
            return { connected: false };
        return { connected: true, maskedKey: this.mask(doc.apiKey), baseUrl: doc.baseUrl };
    }
    async disconnect(organizationId, provider) {
        this.assertAllowed(provider);
        await this.credentialModel.deleteOne({ organizationId, provider });
    }
    assertAllowed(provider) {
        if (!ALLOWED_PROVIDERS.includes(provider)) {
            throw new common_1.BadRequestException(`Unknown integration provider: ${provider}`);
        }
    }
    mask(apiKey) {
        return apiKey.length > 12 ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '***';
    }
};
exports.IntegrationsService = IntegrationsService;
exports.IntegrationsService = IntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(integration_credential_schema_1.IntegrationCredential.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], IntegrationsService);
//# sourceMappingURL=integrations.service.js.map