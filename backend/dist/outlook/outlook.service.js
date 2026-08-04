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
exports.OutlookService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const rxjs_1 = require("rxjs");
const outlook_connection_schema_1 = require("./schemas/outlook-connection.schema");
const GRAPH_SCOPES = 'offline_access User.Read Mail.Read Calendars.Read Contacts.Read';
let OutlookService = class OutlookService {
    constructor(config, http, connectionModel) {
        this.config = config;
        this.http = http;
        this.connectionModel = connectionModel;
    }
    get configured() {
        return Boolean(this.config.get('integrations.msGraph.clientId'));
    }
    async getEmails() {
        if (!this.configured)
            return this.placeholderEmails();
        return this.placeholderEmails();
    }
    async getCalendarEvents() {
        return [];
    }
    async getContacts() {
        return [];
    }
    placeholderEmails() {
        return [
            {
                id: 'msg-1',
                from: 'client@example.com',
                subject: 'Following up on our proposal',
                receivedAt: new Date().toISOString(),
            },
        ];
    }
    buildAuthorizeUrl(state) {
        const clientId = this.config.get('integrations.msGraph.clientId');
        const redirectUri = this.config.get('integrations.msGraph.redirectUri');
        const params = new URLSearchParams({
            client_id: clientId ?? '',
            response_type: 'code',
            redirect_uri: redirectUri ?? '',
            response_mode: 'query',
            scope: GRAPH_SCOPES,
            prompt: 'select_account',
            state,
        });
        return `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?${params.toString()}`;
    }
    async handleCallback(code, userId) {
        const tokens = await this.exchangeCode(code);
        const email = await this.fetchUserEmail(tokens.access_token);
        await this.connectionModel.updateMany({ userId }, { isActive: false });
        await this.connectionModel.findOneAndUpdate({ userId, email }, {
            userId,
            email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            scope: tokens.scope,
            isActive: true,
        }, { upsert: true });
        return { email };
    }
    async getStatus(userId) {
        const active = await this.connectionModel.findOne({ userId, isActive: true }).select({ email: 1 });
        return { connected: Boolean(active), email: active?.email };
    }
    async listAccounts(userId) {
        const connections = await this.connectionModel
            .find({ userId })
            .select({ email: 1, isActive: 1, createdAt: 1 })
            .sort({ createdAt: -1 });
        return connections.map((c) => ({
            email: c.email,
            isActive: c.isActive,
            connectedAt: c.createdAt,
        }));
    }
    async setActive(userId, email) {
        const target = await this.connectionModel.findOne({ userId, email });
        if (!target)
            throw new common_1.NotFoundException(`No connected Outlook account for ${email}`);
        await this.connectionModel.updateMany({ userId }, { isActive: false });
        await this.connectionModel.updateOne({ userId, email }, { isActive: true });
    }
    async disconnect(userId, email) {
        const wasActive = await this.connectionModel.findOne({ userId, email }).select({ isActive: 1 });
        await this.connectionModel.deleteOne({ userId, email });
        if (wasActive?.isActive) {
            const next = await this.connectionModel.findOne({ userId }).sort({ createdAt: -1 });
            if (next)
                await this.connectionModel.updateOne({ _id: next._id }, { isActive: true });
        }
    }
    tokenEndpoint() {
        return `https://login.microsoftonline.com/organizations/oauth2/v2.0/token`;
    }
    async exchangeCode(code) {
        const clientId = this.config.get('integrations.msGraph.clientId');
        const clientSecret = this.config.get('integrations.msGraph.clientSecret');
        const redirectUri = this.config.get('integrations.msGraph.redirectUri');
        const body = new URLSearchParams({
            client_id: clientId ?? '',
            client_secret: clientSecret ?? '',
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri ?? '',
            scope: GRAPH_SCOPES,
        });
        const response = await (0, rxjs_1.firstValueFrom)(this.http.post(this.tokenEndpoint(), body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }));
        return response.data;
    }
    async fetchUserEmail(accessToken) {
        const response = await (0, rxjs_1.firstValueFrom)(this.http.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        }));
        return response.data.mail ?? response.data.userPrincipalName;
    }
};
exports.OutlookService = OutlookService;
exports.OutlookService = OutlookService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, mongoose_1.InjectModel)(outlook_connection_schema_1.OutlookConnection.name)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        axios_1.HttpService,
        mongoose_2.Model])
], OutlookService);
//# sourceMappingURL=outlook.service.js.map