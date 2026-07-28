import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
<<<<<<< HEAD
=======
import { AgentRole, AgentRoleSchema } from '../agent-roles/schemas/agent-role.schema';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
<<<<<<< HEAD
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
=======
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      // Independent local registration (not imported from AgentRolesModule)
      // — same pattern ChatModule already uses for this collection, avoids
      // a circular dependency (AuthModule -> UsersModule, ChatModule ->
      // AuthModule, so UsersModule -> ChatModule would close the cycle).
      { name: AgentRole.name, schema: AgentRoleSchema },
    ]),
  ],
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
