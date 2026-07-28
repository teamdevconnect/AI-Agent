import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    AuthModule,
    ChatModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // GamificationModule reuses this to notify on achievement unlocks —
  // same in-process pipeline python-agent's workflows use cross-service
  // (app/notifications/client.py), just a direct DI call since both are
  // already in this backend process.
  exports: [NotificationsService],
})
export class NotificationsModule {}
