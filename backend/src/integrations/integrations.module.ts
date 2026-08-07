import { HttpModule } from '@nestjs/axios';
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
    // Test Connection (IntegrationsService.testConnection) makes an
    // outbound request to whatever base URL the customer just entered.
    HttpModule.register({ timeout: 15_000 }),
    AuthModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
