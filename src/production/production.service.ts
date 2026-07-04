import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getProductionStages(caseId: string) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    const stages = await this.prisma.productionStage.findMany({
      where: { caseId },
      include: {
        stageType: true,
        technician: {
          include: {
            user: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: {
        stageType: { sequenceOrder: 'asc' },
      },
    });

    return stages.map((stage) => ({
      id: stage.id,
      stageCode: stage.stageType.code,
      stageNameAr: stage.stageType.nameAr,
      stageNameEn: stage.stageType.nameEn,
      sequenceOrder: stage.stageType.sequenceOrder,
      status: stage.status, // Pending, InProgress, Completed
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      assignedTechnicianName: stage.technician?.user.fullName ?? null,
      technicianId: stage.technicianId,
      qualityScore: stage.qualityScore,
      qualityNotes: stage.qualityNotes,
    }));
  }

  async assignTechnician(
    userId: string,
    caseId: string,
    stageId: string,
    technicianId: string,
  ) {
    const stage = await this.prisma.productionStage.findUnique({
      where: { id: stageId },
    });

    if (!stage || stage.caseId !== caseId) {
      throw new NotFoundException('Production stage not found for this case');
    }

    const technician = await this.prisma.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    // Update technician ID and increment workload
    await this.prisma.productionStage.update({
      where: { id: stageId },
      data: { technicianId },
    });

    await this.prisma.technician.update({
      where: { id: technicianId },
      data: { currentWorkload: { increment: 1 } },
    });

    return { message: 'Technician assigned successfully' };
  }

  async updateStageStatus(
    userId: string,
    caseId: string,
    stageId: string,
    status: string, // InProgress, Completed
    qualityScore?: number,
    qualityNotes?: string,
  ) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    // Rules: No production before approval
    const allowedCodes = ['Approved', 'In Production'];
    if (!allowedCodes.includes(caseRecord.status.code)) {
      throw new BadRequestException('No production before approval: Case quotation has not been accepted by the clinic.');
    }

    const stage = await this.prisma.productionStage.findUnique({
      where: { id: stageId },
      include: { stageType: true },
    });

    if (!stage || stage.caseId !== caseId) {
      throw new NotFoundException('Production stage not found');
    }

    const sequenceOrder = stage.stageType.sequenceOrder;

    // Enforce sequence logic: cannot start stage if previous is not completed
    if (status === 'InProgress') {
      const pendingPrev = await this.prisma.productionStage.findFirst({
        where: {
          caseId,
          stageType: { sequenceOrder: { lt: sequenceOrder } },
          status: { not: 'Completed' },
        },
      });

      if (pendingPrev) {
        throw new BadRequestException('Must follow state machine strictly: Previous production stage is not completed yet.');
      }
    }

    // Update Stage status
    const updateData: any = { status };
    if (status === 'InProgress') {
      updateData.startedAt = new Date();
    } else if (status === 'Completed') {
      updateData.completedAt = new Date();
      if (qualityScore !== undefined) updateData.qualityScore = qualityScore;
      if (qualityNotes !== undefined) updateData.qualityNotes = qualityNotes;
    }

    await this.prisma.productionStage.update({
      where: { id: stageId },
      data: updateData,
    });

    await this.notificationsService.sendNotification(
      userId,
      'تحديث تصنيع الحالة',
      `تحديث مرحلة ${stage.stageType.nameAr} للحالة رقم ${caseRecord.caseNumber} إلى: ${status === 'InProgress' ? 'جاري العمل' : 'مكتملة'}.`,
      'Case',
    );

    // Automatically transition overall Case Status:
    // 1. Shift Case status to In Production on first stage start
    if (status === 'InProgress' && caseRecord.status.code === 'Approved') {
      const prodStatus = await this.prisma.caseStatus.findUnique({
        where: { code: 'In Production' },
      });
      if (prodStatus) {
        await this.prisma.case.update({
          where: { id: caseId },
          data: { statusId: prodStatus.id },
        });

        await this.prisma.caseTimeline.create({
          data: {
            caseId,
            statusFromId: caseRecord.statusId,
            statusToId: prodStatus.id,
            changedBy: userId,
            notes: `بدأت عملية التصنيع الرقمي بمرحلة: ${stage.stageType.nameAr}`,
          },
        });
      }
    }

    // 2. Shift Case status to Ready when the last stage (highest sequence) is Completed
    if (status === 'Completed') {
      const remainingStages = await this.prisma.productionStage.count({
        where: {
          caseId,
          status: { not: 'Completed' },
        },
      });

      if (remainingStages === 0) {
        const readyStatus = await this.prisma.caseStatus.findUnique({
          where: { code: 'Ready' },
        });
        if (readyStatus) {
          await this.prisma.case.update({
            where: { id: caseId },
            data: { statusId: readyStatus.id },
          });

          await this.prisma.caseTimeline.create({
            data: {
              caseId,
              statusFromId: caseRecord.statusId,
              statusToId: readyStatus.id,
              changedBy: userId,
              notes: 'اكتملت جميع مراحل التصنيع وفحص الجودة. الحالة جاهزة للتسليم.',
            },
          });
        }
      }
    }

    return { message: `Stage status updated to ${status} successfully` };
  }
}
