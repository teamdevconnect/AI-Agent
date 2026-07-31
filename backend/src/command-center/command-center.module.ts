import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentExecution, AgentExecutionSchema } from './schemas/agent-execution.schema';
import { CommandCenterController } from './command-center.controller';
import { CommandCenterService } from './command-center.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: AgentExecution.name, schema: AgentExecutionSchema }])],
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
})
export class CommandCenterModule {}
