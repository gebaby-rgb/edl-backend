import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CasesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getLookups(userId: string) {
    // Find doctor profile to get associated clinics
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: { clinics: true },
    });

    const clinics = doctor ? doctor.clinics : [];
    const materials = await this.prisma.material.findMany({ where: { isActive: true } });
    const shades = await this.prisma.shade.findMany();
    const priorities = await this.prisma.priority.findMany();

    return {
      clinics,
      materials,
      shades,
      priorities,
    };
  }

  async createCase(
    userId: string,
    data: {
      clinicId: string;
      patientReference: string;
      toothSelection: number[];
      shadeId: string;
      materialId: string;
      priorityId: string;
      dueDate: string;
      status: 'Draft' | 'Submitted';
      files?: { fileName: string; fileType: string; fileUrl: string; fileSize: number }[];
    },
  ) {
    // Resolve doctor profile
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
    });

    if (!doctor) {
      throw new BadRequestException('Authenticated user is not registered as a Doctor');
    }

    // Validation rules: Submitted cases require files
    if (data.status === 'Submitted' && (!data.files || data.files.length === 0)) {
      throw new BadRequestException('Cannot submit a case to EDL Lab without attaching scan files');
    }

    // Resolve case status
    const statusRecord = await this.prisma.caseStatus.findUnique({
      where: { code: data.status },
    });

    if (!statusRecord) {
      throw new BadRequestException(`Status lookup code "${data.status}" not found`);
    }

    // Generate Case Number
    const count = await this.prisma.case.count();
    const caseNumber = `EDL-2026-${(count + 1).toString().padStart(5, '0')}`;

    // Create Case
    const caseRecord = await this.prisma.case.create({
      data: {
        caseNumber,
        doctorId: doctor.id,
        clinicId: data.clinicId,
        patientReference: data.patientReference,
        toothSelection: data.toothSelection,
        shadeId: data.shadeId,
        materialId: data.materialId,
        priorityId: data.priorityId,
        dueDate: new Date(data.dueDate),
        statusId: statusRecord.id,
      },
    });

    // Create files if provided
    if (data.files && data.files.length > 0) {
      await this.prisma.caseFile.createMany({
        data: data.files.map((file) => ({
          caseId: caseRecord.id,
          fileName: file.fileName,
          fileType: file.fileType,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          uploadedBy: userId,
        })),
      });
    }

    // Create timeline event
    await this.prisma.caseTimeline.create({
      data: {
        caseId: caseRecord.id,
        statusFromId: statusRecord.id, // Initial state
        statusToId: statusRecord.id,
        changedBy: userId,
        notes: data.status === 'Submitted' ? 'تم إنشاء الحالة وإرسالها للمعمل.' : 'تم حفظ مسودة الحالة.',
      },
    });

    if (data.status === 'Submitted') {
      await this.notificationsService.sendNotification(
        userId,
        'تقديم حالة جديدة',
        `تم تقديم طلب الحالة رقم ${caseNumber} بنجاح لمعمل EDL للأسنان.`,
        'Case',
      );
    }

    return caseRecord;
  }

  async updateCase(
    userId: string,
    caseId: string,
    data: {
      clinicId?: string;
      patientReference?: string;
      toothSelection?: number[];
      shadeId?: string;
      materialId?: string;
      priorityId?: string;
      dueDate?: string;
    },
  ) {
    const existingCase = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!existingCase) {
      throw new NotFoundException('Case not found');
    }

    // Auto-save updating only allowed in Draft state
    if (existingCase.status.code !== 'Draft') {
      throw new BadRequestException('Cannot modify case parameters. Active case is already in production.');
    }

    const updated = await this.prisma.case.update({
      where: { id: caseId },
      data: {
        clinicId: data.clinicId,
        patientReference: data.patientReference,
        toothSelection: data.toothSelection,
        shadeId: data.shadeId,
        materialId: data.materialId,
        priorityId: data.priorityId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    return updated;
  }

  async submitCase(
    userId: string,
    caseId: string,
    data: {
      files: { fileName: string; fileType: string; fileUrl: string; fileSize: number }[];
    },
  ) {
    const existingCase = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!existingCase) {
      throw new NotFoundException('Case not found');
    }

    if (existingCase.status.code !== 'Draft') {
      throw new BadRequestException('Case has already been submitted');
    }

    if (!data.files || data.files.length === 0) {
      throw new BadRequestException('Cannot submit case to EDL Lab without attaching scan files');
    }

    const submittedStatus = await this.prisma.caseStatus.findUnique({
      where: { code: 'Submitted' },
    });

    if (!submittedStatus) {
      throw new BadRequestException('Submitted status lookup not configured');
    }

    // Create files
    await this.prisma.caseFile.createMany({
      data: data.files.map((file) => ({
        caseId: caseId,
        fileName: file.fileName,
        fileType: file.fileType,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        uploadedBy: userId,
      })),
    });

    // Update case status to Submitted
    const updated = await this.prisma.case.update({
      where: { id: caseId },
      data: {
        statusId: submittedStatus.id,
      },
    });

    // Create timeline log
    await this.prisma.caseTimeline.create({
      data: {
        caseId,
        statusFromId: existingCase.statusId,
        statusToId: submittedStatus.id,
        changedBy: userId,
        notes: 'تم اعتماد وتقديم مسودة الحالة للمعمل مع الملفات المرفقة.',
      },
    });

    await this.notificationsService.sendNotification(
      userId,
      'تقديم الحالة',
      `تم تقديم مسودة الحالة رقم ${existingCase.caseNumber} بنجاح لمعمل EDL.`,
      'Case',
    );

    return updated;
  }

  async getCases(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const roleName = user.role.name;

    if (roleName === 'Doctor' || roleName === 'Clinic Assistant') {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (!doctor) {
        return [];
      }
      return this.prisma.case.findMany({
        where: { doctorId: doctor.id, deletedAt: null },
        include: { status: true, shade: true, material: true, priority: true, files: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    return this.prisma.case.findMany({
      where: { deletedAt: null },
      include: { status: true, shade: true, material: true, priority: true, files: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
