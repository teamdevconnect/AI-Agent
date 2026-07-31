"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmModule = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_module_1 = require("../auth/auth.module");
const dashboard_module_1 = require("../dashboard/dashboard.module");
const organizations_module_1 = require("../organizations/organizations.module");
const users_module_1 = require("../users/users.module");
const account_schema_1 = require("./schemas/account.schema");
const contact_schema_1 = require("./schemas/contact.schema");
const deal_schema_1 = require("./schemas/deal.schema");
const deal_performance_preset_schema_1 = require("./schemas/deal-performance-preset.schema");
const note_schema_1 = require("./schemas/note.schema");
const quote_schema_1 = require("./schemas/quote.schema");
const sales_target_schema_1 = require("./schemas/sales-target.schema");
const tag_schema_1 = require("./schemas/tag.schema");
const business_dashboard_controller_1 = require("./business-dashboard.controller");
const business_dashboard_service_1 = require("./business-dashboard.service");
const crm_controller_1 = require("./crm.controller");
const crm_service_1 = require("./crm.service");
const deal_performance_dashboard_controller_1 = require("./deal-performance-dashboard.controller");
const deal_performance_dashboard_service_1 = require("./deal-performance-dashboard.service");
const deal_performance_preset_controller_1 = require("./deal-performance-preset.controller");
const deal_performance_preset_service_1 = require("./deal-performance-preset.service");
const deals_controller_1 = require("./deals.controller");
const deals_export_service_1 = require("./deals-export.service");
const deals_service_1 = require("./deals.service");
const sales_analytics_service_1 = require("./sales-analytics.service");
const sales_target_controller_1 = require("./sales-target.controller");
let CrmModule = class CrmModule {
};
exports.CrmModule = CrmModule;
exports.CrmModule = CrmModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: contact_schema_1.Contact.name, schema: contact_schema_1.ContactSchema },
                { name: account_schema_1.Account.name, schema: account_schema_1.AccountSchema },
                { name: deal_schema_1.Deal.name, schema: deal_schema_1.DealSchema },
                { name: quote_schema_1.Quote.name, schema: quote_schema_1.QuoteSchema },
                { name: note_schema_1.Note.name, schema: note_schema_1.NoteSchema },
                { name: tag_schema_1.Tag.name, schema: tag_schema_1.TagSchema },
                { name: sales_target_schema_1.SalesTarget.name, schema: sales_target_schema_1.SalesTargetSchema },
                { name: deal_performance_preset_schema_1.DealPerformancePreset.name, schema: deal_performance_preset_schema_1.DealPerformancePresetSchema },
            ]),
            dashboard_module_1.DashboardModule,
            organizations_module_1.OrganizationsModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            axios_1.HttpModule.register({ timeout: 30_000 }),
        ],
        controllers: [
            crm_controller_1.CrmController,
            sales_target_controller_1.SalesTargetController,
            business_dashboard_controller_1.BusinessDashboardController,
            deals_controller_1.DealsController,
            deal_performance_dashboard_controller_1.DealPerformanceDashboardController,
            deal_performance_preset_controller_1.DealPerformancePresetController,
        ],
        providers: [
            crm_service_1.CrmService,
            sales_analytics_service_1.SalesAnalyticsService,
            business_dashboard_service_1.BusinessDashboardService,
            deals_service_1.DealsService,
            deals_export_service_1.DealsExportService,
            deal_performance_dashboard_service_1.DealPerformanceDashboardService,
            deal_performance_preset_service_1.DealPerformancePresetService,
        ],
    })
], CrmModule);
//# sourceMappingURL=crm.module.js.map