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
var StoreSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreSettingsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const mongoose_2 = require("mongoose");
const chat_service_1 = require("../chat/chat.service");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const users_service_1 = require("../users/users.service");
const store_settings_schema_1 = require("./schemas/store-settings.schema");
const MORNING_AGENT_ID = 'store_manager';
const MORNING_PROMPT = "Generate today's to-do list: analyze CRM and Outlook, identify new enquiries and any that haven't received a follow-up, and list concrete priorities for today.";
const EOD_AGENT_ID = 'store_manager';
const EOD_PROMPT = 'Generate an end-of-day report: summarize what was completed today, outstanding follow-ups, and anything that needs attention tomorrow.';
const DEFAULT_TIMEZONE = 'Asia/Kolkata';
function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function todayStamp() {
    return new Date().toISOString().slice(0, 10);
}
function nowMinutesInZone(tz) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
}
let StoreSettingsService = StoreSettingsService_1 = class StoreSettingsService {
    constructor(settingsModel, chatService, dashboardService, usersService) {
        this.settingsModel = settingsModel;
        this.chatService = chatService;
        this.dashboardService = dashboardService;
        this.usersService = usersService;
        this.logger = new common_1.Logger(StoreSettingsService_1.name);
    }
    getSettings() {
        return this.getOrCreateSettings();
    }
    updateSettings(patch) {
        return this.settingsModel.findOneAndUpdate({}, patch, { upsert: true, new: true }).exec();
    }
    runNow(type) {
        const now = new Date().toLocaleDateString();
        if (type === 'eod')
            return this.runForAllUsers(EOD_AGENT_ID, 'eod', EOD_PROMPT, `EOD report — ${now}`);
        return this.runForAllUsers(MORNING_AGENT_ID, 'morning', MORNING_PROMPT, `Morning to-do — ${now}`);
    }
    async checkAndRunDailyJobs() {
        const settings = await this.getOrCreateSettings();
        const today = todayStamp();
        const now = new Date();
        const nowMin = nowMinutesInZone(settings.timezone || DEFAULT_TIMEZONE);
        const openMin = toMinutes(settings.openingTime);
        if (nowMin >= openMin - 30 && nowMin <= openMin && settings.lastMorningRunDate !== today) {
            await this.runForAllUsers(MORNING_AGENT_ID, 'morning', MORNING_PROMPT, `Morning to-do — ${now.toLocaleDateString()}`);
            await this.settingsModel.updateOne({ _id: settings._id }, { lastMorningRunDate: today }).exec();
        }
        const closeMin = toMinutes(settings.closingTime);
        if (nowMin >= closeMin && nowMin <= closeMin + 30 && settings.lastEodRunDate !== today) {
            await this.runForAllUsers(EOD_AGENT_ID, 'eod', EOD_PROMPT, `EOD report — ${now.toLocaleDateString()}`);
            await this.settingsModel.updateOne({ _id: settings._id }, { lastEodRunDate: today }).exec();
        }
    }
    async getOrCreateSettings() {
        const existing = await this.settingsModel.findOne().exec();
        if (existing) {
            if (!existing.timezone) {
                existing.timezone = DEFAULT_TIMEZONE;
                await existing.save();
            }
            return existing;
        }
        return this.settingsModel.create({});
    }
    async runForAllUsers(agentId, reportType, promptText, title) {
        const userIds = await this.usersService.findAllIds();
        const settled = await Promise.allSettled(userIds.map((userId) => this.chatService.generateSystemConversation(userId, agentId, promptText, title)));
        settled.forEach((r, i) => {
            if (r.status === 'rejected') {
                this.logger.error(`Scheduled report failed for user ${userIds[i]}: ${r.reason.message}`);
            }
        });
        const successes = settled
            .map((r, i) => ({ r, userId: userIds[i] }))
            .filter((x) => x.r.status === 'fulfilled')
            .map((x) => ({ value: x.r.value, userId: x.userId }));
        if (successes.length > 0) {
            const chosen = successes[0];
            await this.dashboardService
                .recordDailyReport({
                agentId,
                reportType,
                date: todayStamp(),
                conversationId: chosen.value.conversationId,
                userId: chosen.userId,
            })
                .catch((err) => this.logger.error(`Failed to generate ${reportType} report: ${err.message}`));
        }
        return { usersNotified: successes.length, totalUsers: userIds.length };
    }
};
exports.StoreSettingsService = StoreSettingsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StoreSettingsService.prototype, "checkAndRunDailyJobs", null);
exports.StoreSettingsService = StoreSettingsService = StoreSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(store_settings_schema_1.StoreSettings.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        chat_service_1.ChatService,
        dashboard_service_1.DashboardService,
        users_service_1.UsersService])
], StoreSettingsService);
//# sourceMappingURL=store-settings.service.js.map