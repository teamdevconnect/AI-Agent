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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let CrmService = class CrmService {
    constructor(config) {
        this.config = config;
    }
    get configured() {
        return Boolean(this.config.get('integrations.crm.baseUrl'));
    }
    async getLeads() {
        if (!this.configured)
            return this.placeholderLeads();
        return this.placeholderLeads();
    }
    async getCustomers() {
        return [];
    }
    async getOpportunities() {
        return [];
    }
    placeholderLeads() {
        return [
            { id: 'lead-1', name: 'Acme Corp', stage: 'new', createdAt: new Date().toISOString() },
            { id: 'lead-2', name: 'Globex Inc', stage: 'contacted', createdAt: new Date().toISOString() },
        ];
    }
};
exports.CrmService = CrmService;
exports.CrmService = CrmService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CrmService);
//# sourceMappingURL=crm.service.js.map