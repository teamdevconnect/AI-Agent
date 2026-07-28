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
exports.UsersService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bcrypt = require("bcrypt");
const mongoose_2 = require("mongoose");
const agent_role_schema_1 = require("../agent-roles/schemas/agent-role.schema");
const agents_1 = require("../chat/agents");
const user_schema_1 = require("./schemas/user.schema");
const SALT_ROUNDS = 12;
let UsersService = class UsersService {
    constructor(userModel, agentRoleModel) {
        this.userModel = userModel;
        this.agentRoleModel = agentRoleModel;
    }
    findByEmail(email) {
        return this.userModel.findOne({ email: email.toLowerCase() }).exec();
    }
    findById(id) {
        return this.userModel.findById(id).exec();
    }
    async findAllIds() {
        const users = await this.userModel.find().select({ _id: 1 }).exec();
        return users.map((u) => u._id.toString());
    }
    async findAll() {
        return this.userModel.find().exec();
    }
    create(data) {
        return this.userModel.create(data);
    }
    async createByAdmin(dto) {
        if (dto.role === 'agent_user') {
            if (!dto.assignedAgentId) {
                throw new common_1.BadRequestException('assignedAgentId is required for agent_user role');
            }
            if (!(await this.resolveValidAgentIds()).has(dto.assignedAgentId)) {
                throw new common_1.BadRequestException('assignedAgentId is not a known agent');
            }
        }
        const tempPassword = (0, crypto_1.randomBytes)(9).toString('base64url');
        const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        const user = await this.userModel.create({
            email: dto.email,
            passwordHash,
            name: dto.name,
            roles: [dto.role],
            assignedAgentId: dto.role === 'agent_user' ? dto.assignedAgentId : undefined,
            active: true,
        });
        return { user: this.toPublic(user), tempPassword };
    }
    async updateByAdmin(id, dto) {
        if (dto.assignedAgentId && !(await this.resolveValidAgentIds()).has(dto.assignedAgentId)) {
            throw new common_1.BadRequestException('assignedAgentId is not a known agent');
        }
        const update = {};
        if (dto.role)
            update.roles = [dto.role];
        if (dto.assignedAgentId !== undefined)
            update.assignedAgentId = dto.assignedAgentId;
        if (dto.active !== undefined)
            update.active = dto.active;
        const updated = await this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
        if (!updated)
            throw new common_1.NotFoundException('User not found');
        return this.toPublic(updated);
    }
    async deleteByAdmin(id) {
        const deleted = await this.userModel.findByIdAndDelete(id).exec();
        if (!deleted)
            throw new common_1.NotFoundException('User not found');
    }
    toPublic(user) {
        return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            roles: user.roles,
            assignedAgentId: user.assignedAgentId,
            active: user.active,
        };
    }
    async resolveValidAgentIds() {
        const dynamic = await this.agentRoleModel.find({ status: 'active' }).select({ slug: 1 }).exec();
        return new Set([...agents_1.CHAT_AGENTS.map((a) => a.id), ...dynamic.map((d) => d.slug)]);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_role_schema_1.AgentRole.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], UsersService);
//# sourceMappingURL=users.service.js.map