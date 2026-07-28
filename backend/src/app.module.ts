import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
<<<<<<< HEAD
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
=======
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { AuditModule } from './audit/audit.module';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { DocumentsModule } from './documents/documents.module';
import { CrmModule } from './crm/crm.module';
import { OutlookModule } from './outlook/outlook.module';
import { IntegrationsModule } from './integrations/integrations.module';
<<<<<<< HEAD
=======
import { StoreSettingsModule } from './store-settings/store-settings.module';
import { AgentRolesModule } from './agent-roles/agent-roles.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GamificationModule } from './gamification/gamification.module';
import { NotificationsModule } from './notifications/notifications.module';
>>>>>>> 6a60a8648 (Initial AI Agent source code)
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
<<<<<<< HEAD
=======
    ScheduleModule.forRoot(),
    // App-wide default: 60 requests/minute per IP. Per-route overrides via
    // @Throttle() (see AuthController's tighter login/register limit) or
    // @SkipThrottle() (see HealthController).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
>>>>>>> 6a60a8648 (Initial AI Agent source code)
    AuthModule,
    UsersModule,
    ChatModule,
    DocumentsModule,
    CrmModule,
    OutlookModule,
    IntegrationsModule,
<<<<<<< HEAD
  ],
  controllers: [HealthController],
=======
    StoreSettingsModule,
    AgentRolesModule,
    DashboardModule,
    NotificationsModule,
    GamificationModule,
    // Registers a global audit-logging interceptor (see AuditModule) in
    // addition to its own admin-only GET /audit-logs viewer.
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
>>>>>>> 6a60a8648 (Initial AI Agent source code)
})
export class AppModule {}
