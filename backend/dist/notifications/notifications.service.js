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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_gateway_1 = require("../chat/chat.gateway");
const notification_schema_1 = require("./schemas/notification.schema");
let NotificationsService = class NotificationsService {
    constructor(notificationModel, chatGateway) {
        this.notificationModel = notificationModel;
        this.chatGateway = chatGateway;
    }
    async create(userId, dto) {
        const notification = await this.notificationModel.create({ userId, ...dto });
        this.chatGateway.emitToUser(userId, 'notification', notification);
        return notification;
    }
    list(userId) {
        return this.notificationModel.find({ userId }).sort({ createdAt: -1 }).limit(50).exec();
    }
    async markRead(userId, id) {
        await this.notificationModel.updateOne({ _id: id, userId }, { read: true }).exec();
    }
    async markAllRead(userId) {
        await this.notificationModel.updateMany({ userId, read: false }, { read: true }).exec();
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(notification_schema_1.Notification.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        chat_gateway_1.ChatGateway])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map