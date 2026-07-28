import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { UserStats, UserStatsSchema } from './schemas/user-stats.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserStats.name, schema: UserStatsSchema }]), NotificationsModule],
  controllers: [GamificationController],
  providers: [GamificationService],
  // TasksService (dashboard module) calls recordTaskCompletion() on a
  // genuine done-transition — see dashboard.module.ts's imports.
  exports: [GamificationService],
})
export class GamificationModule {}
