import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { GridFsService } from '../common/gridfs/gridfs.service';
import { BusinessProfile, BusinessProfileSchema } from './schemas/business-profile.schema';
import { BusinessKnowledgeDocument, BusinessKnowledgeDocumentSchema } from './schemas/business-knowledge-document.schema';
import { BusinessProfileController } from './business-profile.controller';
import { BusinessProfileService } from './business-profile.service';
import { BusinessKnowledgeDocumentsController } from './business-knowledge-documents.controller';
import { BusinessKnowledgeDocumentsService } from './business-knowledge-documents.service';
import { BusinessKnowledgeGridFsService } from './business-knowledge-gridfs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BusinessProfile.name, schema: BusinessProfileSchema },
      { name: BusinessKnowledgeDocument.name, schema: BusinessKnowledgeDocumentSchema },
    ]),
    AuthModule,
    // Generous timeout — both the profile sync call and document extraction
    // block on real Claude calls synchronously, same reasoning as
    // finance.module.ts's identical setting.
    HttpModule.register({ timeout: 60_000 }),
  ],
  controllers: [BusinessProfileController, BusinessKnowledgeDocumentsController],
  providers: [BusinessProfileService, GridFsService, BusinessKnowledgeGridFsService, BusinessKnowledgeDocumentsService],
})
export class BusinessKnowledgeModule {}
