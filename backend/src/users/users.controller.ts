<<<<<<< HEAD
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
=======
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const found = await this.usersService.findById(user.sub);
    return found ? this.usersService.toPublic(found) : null;
  }
<<<<<<< HEAD
=======

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async list() {
    const users = await this.usersService.findAll();
    return users.map((u) => this.usersService.toPublic(u));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createByAdmin(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@CurrentUser() caller: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (id === caller.sub && (dto.active === false || (dto.role && dto.role !== 'admin'))) {
      throw new BadRequestException("Can't demote or disable your own account");
    }
    return this.usersService.updateByAdmin(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@CurrentUser() caller: JwtPayload, @Param('id') id: string) {
    if (id === caller.sub) {
      throw new BadRequestException("Can't delete your own account");
    }
    return this.usersService.deleteByAdmin(id);
  }
>>>>>>> 6a60a8648 (Initial AI Agent source code)
}
