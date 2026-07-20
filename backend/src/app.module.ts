import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { DocumentsModule } from './documents/documents.module';
import { CrmModule } from './crm/crm.module';
import { OutlookModule } from './outlook/outlook.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
    AuthModule,
    UsersModule,
    ChatModule,
    DocumentsModule,
    CrmModule,
    OutlookModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
