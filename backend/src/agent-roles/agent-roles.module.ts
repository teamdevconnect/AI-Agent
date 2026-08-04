import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AgentRolesController } from './agent-roles.controller';
import { AgentRolesService } from './agent-roles.service';
import { AgentRole, AgentRoleSchema } from './schemas/agent-role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AgentRole.name, schema: AgentRoleSchema }]),
    // Extraction is an LLM round-trip (5-15s typical) — same generous
    // timeout as DocumentsModule's relay to python-agent.
    HttpModule.register({ timeout: 60_000 }),
    AuthModule,
  ],
  controllers: [AgentRolesController],
  providers: [AgentRolesService],
})
export class AgentRolesModule {}
