import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from './jwt-payload.interface';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private jwtService: JwtService,
  ) {}

  /** Registration always creates a brand-new organization (+ its default
   * store) with this user as its owner — there's no "join an existing org"
   * flow yet; adding teammates afterward goes through POST /users (admin
   * panel), which scopes the new account to the caller's own org. */
  async register(email: string, password: string, name: string, organizationName: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const { organization, store } = await this.organizationsService.createOrganizationWithOwner(organizationName);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usersService.create({
      email,
      passwordHash,
      name,
      organizationId: organization._id.toString(),
      storeId: store._id.toString(),
      // 'admin' kept alongside 'owner' so every existing @Roles('admin')
      // gate (store-settings, integrations, agent-roles, user management)
      // keeps working for the org's creator without touching those decorators.
      roles: ['owner', 'admin'],
    });
    return this.issueToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      // Same generic failure for "no such user" and "wrong password" —
      // don't turn this into a user-enumeration oracle.
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.active === false) {
      throw new UnauthorizedException('Account disabled');
    }
    return this.issueToken(user);
  }

  private issueToken(user: UserDocument) {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
      organizationId: user.organizationId,
      storeId: user.storeId,
      assignedAgentId: user.assignedAgentId,
      department: user.department,
    };
    return { accessToken: this.jwtService.sign(payload) };
  }
}
