<<<<<<< HEAD
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}
=======
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
>>>>>>> 6a60a8648 (Initial AI Agent source code)

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

<<<<<<< HEAD
=======
  async findAllIds(): Promise<string[]> {
    const users = await this.userModel.find().select({ _id: 1 }).exec();
    return users.map((u) => u._id.toString());
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  create(data: { email: string; passwordHash: string; name: string }) {
    return this.userModel.create(data);
  }

<<<<<<< HEAD
=======
  async createByAdmin(dto: CreateUserDto) {
    if (dto.role === 'agent_user') {
      if (!dto.assignedAgentId) {
        throw new BadRequestException('assignedAgentId is required for agent_user role');
      }
      if (!(await this.resolveValidAgentIds()).has(dto.assignedAgentId)) {
        throw new BadRequestException('assignedAgentId is not a known agent');
      }
    }

    const tempPassword = randomBytes(9).toString('base64url');
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

  async updateByAdmin(id: string, dto: UpdateUserDto) {
    if (dto.assignedAgentId && !(await this.resolveValidAgentIds()).has(dto.assignedAgentId)) {
      throw new BadRequestException('assignedAgentId is not a known agent');
    }

    const update: Record<string, unknown> = {};
    if (dto.role) update.roles = [dto.role];
    if (dto.assignedAgentId !== undefined) update.assignedAgentId = dto.assignedAgentId;
    if (dto.active !== undefined) update.active = dto.active;

    const updated = await this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
    if (!updated) throw new NotFoundException('User not found');
    return this.toPublic(updated);
  }

  async deleteByAdmin(id: string) {
    const deleted = await this.userModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('User not found');
  }

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  toPublic(user: UserDocument) {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles,
<<<<<<< HEAD
    };
  }
=======
      assignedAgentId: user.assignedAgentId,
      active: user.active,
    };
  }

  private async resolveValidAgentIds(): Promise<Set<string>> {
    const dynamic = await this.agentRoleModel.find({ status: 'active' }).select({ slug: 1 }).exec();
    return new Set<string>([...CHAT_AGENTS.map((a) => a.id), ...dynamic.map((d) => d.slug)]);
  }
>>>>>>> 6a60a8648 (Initial AI Agent source code)
}
