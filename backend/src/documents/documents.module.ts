import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [HttpModule.register({ timeout: 60_000 })],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
