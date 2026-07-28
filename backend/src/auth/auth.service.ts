import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
<<<<<<< HEAD
=======
import { UserDocument } from '../users/schemas/user.schema';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { JwtPayload } from './jwt-payload.interface';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usersService.create({ email, passwordHash, name });
<<<<<<< HEAD
    return this.issueToken(user._id.toString(), user.email, user.roles);
=======
    return this.issueToken(user);
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
<<<<<<< HEAD
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(user._id.toString(), user.email, user.roles);
  }

  private issueToken(sub: string, email: string, roles: string[]) {
    const payload: JwtPayload = { sub, email, roles };
=======
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
      assignedAgentId: user.assignedAgentId,
    };
>>>>>>> 6a60a8648 (Initial AI Agent source code)
    return { accessToken: this.jwtService.sign(payload) };
  }
}
