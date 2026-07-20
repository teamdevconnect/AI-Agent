import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import {
  IntegrationCredential,
  IntegrationCredentialSchema,
} from './schemas/integration-credential.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationCredential.name, schema: IntegrationCredentialSchema },
    ]),
    AuthModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
