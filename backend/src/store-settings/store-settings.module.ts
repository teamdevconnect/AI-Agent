import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { UsersModule } from '../users/users.module';
import { StoreSettings, StoreSettingsSchema } from './schemas/store-settings.schema';
import { StoreSettingsController } from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: StoreSettings.name, schema: StoreSettingsSchema }]),
    AuthModule,
    ChatModule,
    DashboardModule,
    UsersModule,
  ],
  controllers: [StoreSettingsController],
  providers: [StoreSettingsService],
})
export class StoreSettingsModule {}
