import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async scheduleDelivery(
    userId: string,
    caseId: string,
    body: { courierId: string; notes?: string },
  ) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    // Verify case status is ready for dispatch
    if (caseRecord.status.code !== 'Ready') {
      throw new BadRequestException('Case cannot be shipped: Production stages must be completed first.');
    }

    const shippedStatus = await this.prisma.caseStatus.findUnique({
      where: { code: 'Shipped' },
    });

    if (!shippedStatus) {
      throw new BadRequestException('Shipped status lookup not configured');
    }

    // Create or update Delivery Order
    const delivery = await this.prisma.deliveryOrder.upsert({
      where: { caseId },
      create: {
        caseId,
        courierId: body.courierId,
        status: 'Pending',
        notes: body.notes,
        pickupTime: new Date(),
      },
      update: {
        courierId: body.courierId,
        status: 'Pending',
        notes: body.notes,
        pickupTime: new Date(),
      },
    });

    // Update case status to Shipped
    await this.prisma.case.update({
      where: { id: caseId },
      data: { statusId: shippedStatus.id },
    });

    // Log timeline
    await this.prisma.caseTimeline.create({
      data: {
        caseId,
        statusFromId: caseRecord.statusId,
        statusToId: shippedStatus.id,
        changedBy: userId,
        notes: `تم جدولة الشحن وتكليف المندوب بالاستلام والتسليم للعيادة.`,
      },
    });

    await this.notificationsService.sendNotification(
      userId,
      'شحن حالة وتوصيلها',
      `تم شحن وتوصيل حالتك رقم ${caseRecord.caseNumber} مع المندوب. يرجى تتبع حالتها.`,
      'Delivery',
    );

    return delivery;
  }

  async confirmDelivery(
    userId: string,
    deliveryId: string,
    body: { signatureUrl?: string },
  ) {
    const delivery = await this.prisma.deliveryOrder.findUnique({
      where: { id: deliveryId },
      include: { case: { include: { status: true } } },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery order not found');
    }

    if (delivery.status === 'Delivered') {
      throw new BadRequestException('Delivery order is already confirmed');
    }

    const deliveredStatus = await this.prisma.caseStatus.findUnique({
      where: { code: 'Delivered' },
    });

    if (!deliveredStatus) {
      throw new BadRequestException('Delivered status lookup not configured');
    }

    // Update Delivery Order
    await this.prisma.deliveryOrder.update({
      where: { id: deliveryId },
      data: {
        status: 'Delivered',
        deliveryTime: new Date(),
        signatureUrl: body.signatureUrl ?? 'https://storage.edl-lab.com/signatures/sign_confirmed.png',
      },
    });

    // Update Case status to Delivered
    await this.prisma.case.update({
      where: { id: delivery.caseId },
      data: { statusId: deliveredStatus.id },
    });

    // Log timeline
    await this.prisma.caseTimeline.create({
      data: {
        caseId: delivery.caseId,
        statusFromId: delivery.case.statusId,
        statusToId: deliveredStatus.id,
        changedBy: userId,
        notes: 'تم تأكيد تسليم ووصول الحالة للعيادة بنجاح وتوقيع الطبيب.',
      },
    });

    await this.notificationsService.sendNotification(
      userId,
      'تأكيد استلام الطلب',
      `تم تأكيد تسليم الحالة رقم ${delivery.case.caseNumber} وتوقيع المستلم بنجاح.`,
      'Delivery',
    );

    return { message: 'Delivery confirmed and case status updated to Delivered successfully.' };
  }
}
