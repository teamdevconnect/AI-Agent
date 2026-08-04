"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const chat_module_1 = require("../chat/chat.module");
const dashboard_module_1 = require("../dashboard/dashboard.module");
const notifications_module_1 = require("../notifications/notifications.module");
const organizations_module_1 = require("../organizations/organizations.module");
const timeline_module_1 = require("../timeline/timeline.module");
const users_module_1 = require("../users/users.module");
const store_settings_controller_1 = require("./store-settings.controller");
const store_settings_service_1 = require("./store-settings.service");
let StoreSettingsModule = class StoreSettingsModule {
};
exports.StoreSettingsModule = StoreSettingsModule;
exports.StoreSettingsModule = StoreSettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [organizations_module_1.OrganizationsModule, auth_module_1.AuthModule, chat_module_1.ChatModule, dashboard_module_1.DashboardModule, users_module_1.UsersModule, notifications_module_1.NotificationsModule, timeline_module_1.TimelineModule],
        controllers: [store_settings_controller_1.StoreSettingsController],
        providers: [store_settings_service_1.StoreSettingsService],
    })
], StoreSettingsModule);
//# sourceMappingURL=store-settings.module.js.map