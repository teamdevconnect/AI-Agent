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
exports.UpdateStoreSettingsDto = void 0;
const class_validator_1 = require("class-validator");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
let IsIanaTimezoneConstraint = class IsIanaTimezoneConstraint {
    validate(value) {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
        }
        catch {
            return false;
        }
    }
    defaultMessage() {
        return 'timezone must be a valid IANA timezone name (e.g. "Asia/Kolkata")';
    }
};
IsIanaTimezoneConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isIanaTimezone', async: false })
], IsIanaTimezoneConstraint);
class UpdateStoreSettingsDto {
}
exports.UpdateStoreSettingsDto = UpdateStoreSettingsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'openingTime must be in 24-hour HH:mm format' }),
    __metadata("design:type", String)
], UpdateStoreSettingsDto.prototype, "openingTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(HHMM, { message: 'closingTime must be in 24-hour HH:mm format' }),
    __metadata("design:type", String)
], UpdateStoreSettingsDto.prototype, "closingTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Validate)(IsIanaTimezoneConstraint),
    __metadata("design:type", String)
], UpdateStoreSettingsDto.prototype, "timezone", void 0);
//# sourceMappingURL=update-store-settings.dto.js.map