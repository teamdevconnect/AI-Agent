import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  // AuthModule: JwtModule/PassportModule for JwtAuthGuard. UsersModule:
  // UsersService for the sessions array itself. ChatModule: ChatGateway, so
  // a revoke can also disconnect that session's live socket(s) — no cycle,
  // neither exports back to this module.
  imports: [AuthModule, ChatModule, UsersModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
