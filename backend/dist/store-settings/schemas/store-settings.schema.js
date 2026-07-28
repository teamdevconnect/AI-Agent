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
exports.StoreSettingsSchema = exports.StoreSettings = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let StoreSettings = class StoreSettings {
};
exports.StoreSettings = StoreSettings;
__decorate([
    (0, mongoose_1.Prop)({ default: '09:00' }),
    __metadata("design:type", String)
], StoreSettings.prototype, "openingTime", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '18:00' }),
    __metadata("design:type", String)
], StoreSettings.prototype, "closingTime", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'Asia/Kolkata' }),
    __metadata("design:type", String)
], StoreSettings.prototype, "timezone", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], StoreSettings.prototype, "lastMorningRunDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], StoreSettings.prototype, "lastEodRunDate", void 0);
exports.StoreSettings = StoreSettings = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'store_settings' })
], StoreSettings);
exports.StoreSettingsSchema = mongoose_1.SchemaFactory.createForClass(StoreSettings);
//# sourceMappingURL=store-settings.schema.js.map