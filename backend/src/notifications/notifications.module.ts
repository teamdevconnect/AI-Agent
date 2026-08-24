import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { WebPushService } from './web-push.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    AuthModule,
    ChatModule,
    // UsersModule/OrganizationsModule: preference/policy lookups in
    // NotificationsService.dispatchExternalChannels. MailService is
    // injected directly without an import — MailModule is @Global() (same
    // convention AuthModule already follows for it). No cycles — neither
    // of these imports NotificationsModule or ChatModule back.
    UsersModule,
    OrganizationsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushService],
  // GamificationModule reuses this to notify on achievement unlocks —
  // same in-process pipeline python-agent's workflows use cross-service
  // (app/notifications/client.py), just a direct DI call since both are
  // already in this backend process.
  exports: [NotificationsService],
})
export class NotificationsModule {}
