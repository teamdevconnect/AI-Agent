import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatGateway } from '../chat/chat.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private chatGateway: ChatGateway,
  ) {}

  async create(userId: string, dto: CreateNotificationDto, organizationId?: string) {
    const notification = await this.notificationModel.create({ userId, organizationId, ...dto });
    // Live push if they're connected right now (ChatGateway.emitToUser) — a
    // no-op otherwise; GET /notifications below is the source of truth for
    // anyone who missed the live event.
    this.chatGateway.emitToUser(userId, 'notification', notification);
    return notification;
  }

  list(userId: string) {
    return this.notificationModel.find({ userId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  async markRead(userId: string, id: string) {
    await this.notificationModel.updateOne({ _id: id, userId }, { read: true }).exec();
  }

  async markAllRead(userId: string) {
    await this.notificationModel.updateMany({ userId, read: false }, { read: true }).exec();
  }
}
