import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../logger/logger.service';

interface NotificationLog {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string; // 'Case', 'Quote', 'Delivery'
  createdAt: Date;
  read: boolean;
}

@Injectable()
export class NotificationsService {
  // In-memory store for user notification histories in the MVP
  private notificationHistoryList: NotificationLog[] = [];

  constructor(
    private prisma: PrismaService,
    private logger: AppLogger,
  ) {
    this.logger.setContext('NotificationsService');
  }

  async registerDevice(userId: string, body: { pushToken: string; platform: string }) {
    if (!body.pushToken || !body.platform) {
      throw new BadRequestException('pushToken and platform are required parameters');
    }

    // Save token in device table
    await this.prisma.device.create({
      data: {
        userId,
        pushToken: body.pushToken,
        platform: body.platform,
      },
    });

    return { message: 'Push notification device registered successfully.' };
  }

  async sendNotification(userId: string, title: string, body: string, type: string) {
    const log: NotificationLog = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      body,
      type,
      createdAt: new Date(),
      read: false,
    };

    // Insert to inbox list
    this.notificationHistoryList.unshift(log);

    // Fetch registered push tokens for user
    const devices = await this.prisma.device.findMany({
      where: { userId },
    });

    // Simulate sending FCM pushes
    for (const dev of devices) {
      this.logger.debug(
        `[FCM Dispatch] token=${dev.pushToken} | title="${title}"`,
        'NotificationsService',
      );
    }

    return log;
  }

  async getUserNotifications(userId: string) {
    // Filter notification logs for user, fallback to mocked seed notifications if inbox is empty
    const userNotifs = this.notificationHistoryList.filter((n) => n.userId === userId);
    
    if (userNotifs.length === 0) {
      // Mock seed notification logs for visual presentation
      return [
        {
          id: 'mock_notif_1',
          userId,
          title: 'تحديث حالة الطلب',
          body: 'تم قبول وقبول عرض السعر للحالة EDL-2026-00041 من قبل الطبيب.',
          type: 'Case',
          createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
          read: false,
        },
        {
          id: 'mock_notif_2',
          userId,
          title: 'عرض سعر جديد',
          body: 'تم إصدار مقايسة مالية جديدة للحالة EDL-2026-00041 بقيمة 1,750 ج.م.',
          type: 'Quote',
          createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          read: true,
        },
        {
          id: 'mock_notif_3',
          userId,
          title: 'جدولة شحن الشحنة',
          body: 'جاري تسليم وتوصيل المنتج للعيادة مع المندوب أ. محمد.',
          type: 'Delivery',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
          read: true,
        },
      ];
    }

    return userNotifs;
  }
}
