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
exports.StoreSettingsController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const update_store_settings_dto_1 = require("./dto/update-store-settings.dto");
const store_settings_service_1 = require("./store-settings.service");
let StoreSettingsController = class StoreSettingsController {
    constructor(storeSettingsService) {
        this.storeSettingsService = storeSettingsService;
    }
    get() {
        return this.storeSettingsService.getSettings();
    }
    update(dto) {
        return this.storeSettingsService.updateSettings(dto);
    }
    runNow(type) {
        return this.storeSettingsService.runNow(type === 'eod' ? 'eod' : 'morning');
    }
};
exports.StoreSettingsController = StoreSettingsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StoreSettingsController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_store_settings_dto_1.UpdateStoreSettingsDto]),
    __metadata("design:returntype", void 0)
], StoreSettingsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('run-now'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StoreSettingsController.prototype, "runNow", null);
exports.StoreSettingsController = StoreSettingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('store-settings'),
    __metadata("design:paramtypes", [store_settings_service_1.StoreSettingsService])
], StoreSettingsController);
//# sourceMappingURL=store-settings.controller.js.map