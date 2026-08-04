import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { AgentRole, AgentRoleDocument } from '../agent-roles/schemas/agent-role.schema';
import { CHAT_AGENTS } from '../chat/agents';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // Independent local registration for validation only — importing
    // ChatModule directly here would create a cycle (AuthModule imports
    // UsersModule, ChatModule imports AuthModule), same reasoning ChatModule
    // itself already uses for this collection.
    @InjectModel(AgentRole.name) private agentRoleModel: Model<AgentRoleDocument>,
  ) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  /** Cron/report fan-out, scoped to one store within one org — replaces the
   * old system-wide findAllIds(). storeId omitted (or undefined on the user)
   * matches "belongs to the org generally" so an org owner without a
   * specific store assignment still gets the default store's reports. */
  async findIdsByOrgAndStore(organizationId: string, storeId: string): Promise<string[]> {
    const users = await this.userModel
      .find({ organizationId, $or: [{ storeId: { $exists: false } }, { storeId }] })
      .select({ _id: 1 })
      .exec();
    return users.map((u) => u._id.toString());
  }

  async findAll(organizationId: string): Promise<UserDocument[]> {
    return this.userModel.find({ organizationId }).exec();
  }

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    organizationId: string;
    storeId?: string;
    roles?: string[];
  }) {
    return this.userModel.create(data);
  }

  async createByAdmin(dto: CreateUserDto, organizationId: string) {
    if (dto.role === 'agent_user') {
      if (!dto.assignedAgentId) {
        throw new BadRequestException('assignedAgentId is required for agent_user role');
      }
      if (!(await this.resolveValidAgentIds(organizationId)).has(dto.assignedAgentId)) {
        throw new BadRequestException('assignedAgentId is not a known agent');
      }
    }

    const tempPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const user = await this.userModel.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      organizationId,
      storeId: dto.storeId,
      roles: [dto.role],
      assignedAgentId: dto.role === 'agent_user' ? dto.assignedAgentId : undefined,
      department: dto.department,
      active: true,
    });
    return { user: this.toPublic(user), tempPassword };
  }

  async updateByAdmin(id: string, dto: UpdateUserDto, organizationId: string) {
    if (dto.assignedAgentId && !(await this.resolveValidAgentIds(organizationId)).has(dto.assignedAgentId)) {
      throw new BadRequestException('assignedAgentId is not a known agent');
    }

    const update: Record<string, unknown> = {};
    if (dto.role) update.roles = [dto.role];
    if (dto.assignedAgentId !== undefined) update.assignedAgentId = dto.assignedAgentId;
    if (dto.storeId !== undefined) update.storeId = dto.storeId;
    if (dto.active !== undefined) update.active = dto.active;
    if (dto.department !== undefined) update.department = dto.department;

    // Scoped by organizationId, not just _id — an admin from org A must
    // never be able to modify a user in org B, even by guessing/enumerating
    // a valid Mongo _id.
    const updated = await this.userModel.findOneAndUpdate({ _id: id, organizationId }, update, { new: true }).exec();
    if (!updated) throw new NotFoundException('User not found');
    return this.toPublic(updated);
  }

  async deleteByAdmin(id: string, organizationId: string) {
    const deleted = await this.userModel.findOneAndDelete({ _id: id, organizationId }).exec();
    if (!deleted) throw new NotFoundException('User not found');
  }

  toPublic(user: UserDocument) {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      storeId: user.storeId,
      roles: user.roles,
      assignedAgentId: user.assignedAgentId,
      department: user.department,
      active: user.active,
    };
  }

  private async resolveValidAgentIds(organizationId: string): Promise<Set<string>> {
    const dynamic = await this.agentRoleModel
      .find({ status: 'active', organizationId })
      .select({ slug: 1 })
      .exec();
    return new Set<string>([...CHAT_AGENTS.map((a) => a.id), ...dynamic.map((d) => d.slug)]);
  }
}
