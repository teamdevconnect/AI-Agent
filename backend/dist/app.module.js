"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const configuration_1 = __importDefault(require("./config/configuration"));
const audit_module_1 = require("./audit/audit.module");
const auth_module_1 = require("./auth/auth.module");
const organizations_module_1 = require("./organizations/organizations.module");
const users_module_1 = require("./users/users.module");
const chat_module_1 = require("./chat/chat.module");
const documents_module_1 = require("./documents/documents.module");
const crm_module_1 = require("./crm/crm.module");
const outlook_module_1 = require("./outlook/outlook.module");
const gmail_module_1 = require("./gmail/gmail.module");
const integrations_module_1 = require("./integrations/integrations.module");
const store_settings_module_1 = require("./store-settings/store-settings.module");
const agent_roles_module_1 = require("./agent-roles/agent-roles.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const gamification_module_1 = require("./gamification/gamification.module");
const notifications_module_1 = require("./notifications/notifications.module");
const timeline_module_1 = require("./timeline/timeline.module");
const command_center_module_1 = require("./command-center/command-center.module");
const workflows_module_1 = require("./workflows/workflows.module");
const health_controller_1 = require("./health/health.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default] }),
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    uri: config.get('mongoUri'),
                }),
            }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
            auth_module_1.AuthModule,
            organizations_module_1.OrganizationsModule,
            users_module_1.UsersModule,
            chat_module_1.ChatModule,
            documents_module_1.DocumentsModule,
            crm_module_1.CrmModule,
            outlook_module_1.OutlookModule,
            gmail_module_1.GmailModule,
            integrations_module_1.IntegrationsModule,
            store_settings_module_1.StoreSettingsModule,
            agent_roles_module_1.AgentRolesModule,
            dashboard_module_1.DashboardModule,
            notifications_module_1.NotificationsModule,
            gamification_module_1.GamificationModule,
            timeline_module_1.TimelineModule,
            command_center_module_1.CommandCenterModule,
            workflows_module_1.WorkflowsModule,
            audit_module_1.AuditModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [{ provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard }],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map