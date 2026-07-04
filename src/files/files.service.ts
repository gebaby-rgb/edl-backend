import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async validateCaseAccess(userId: string, caseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('User session not found');
    }

    const roleName = user.role?.name;

    if (roleName === 'Laboratory Admin' || roleName === 'Owner') {
      return;
    }

    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { doctor: true },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    if (roleName === 'Doctor' || roleName === 'Clinic Assistant') {
      if (caseRecord.doctor.userId !== userId) {
        throw new ForbiddenException('Access denied: you do not own this case');
      }
    }

    if (roleName === 'Technician') {
      const technician = await this.prisma.technician.findUnique({
        where: { userId },
      });
      if (!technician) {
        throw new ForbiddenException('Technician profile not found');
      }

      const assigned = await this.prisma.productionStage.findFirst({
        where: {
          caseId,
          technicianId: technician.id,
        },
      });

      if (!assigned) {
        throw new ForbiddenException('Access denied: you are not assigned to work on this case');
      }
    }
  }

  async generateUploadUrl(
    userId: string,
    body: { caseId: string; fileName: string; fileType: string; fileSize: number },
  ) {
    await this.validateCaseAccess(userId, body.caseId);

    const caseRecord = await this.prisma.case.findUnique({
      where: { id: body.caseId },
    });

    if (!caseRecord) {
      throw new NotFoundException('Linked case not found');
    }

    const bucketName = 'edl-dental-scans';
    const objectKey = `cases/${body.caseId}/${body.fileName}`;
    
    // Simulate generation of S3 pre-signed PUT URL
    const uploadUrl = `https://${bucketName}.s3.eu-west-1.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260703%2Fev-west-1%2Fs3%2Faws4_request&X-Amz-Date=20260703T090000Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=mock_signature_put_val_2026`;

    // Simulate S3 pre-signed GET URL for previews
    const previewUrl = `https://${bucketName}.s3.eu-west-1.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260703%2Fev-west-1%2Fs3%2Faws4_request&X-Amz-Date=20260703T090000Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=mock_signature_get_val_2026`;

    // Register File inside database
    const fileRecord = await this.prisma.caseFile.create({
      data: {
        caseId: body.caseId,
        fileName: body.fileName,
        fileType: body.fileType,
        fileUrl: previewUrl,
        fileSize: body.fileSize,
        uploadedBy: userId,
      },
    });

    return {
      fileId: fileRecord.id,
      uploadUrl,
      previewUrl,
    };
  }

  async getCaseFiles(userId: string, caseId: string) {
    await this.validateCaseAccess(userId, caseId);

    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    const files = await this.prisma.caseFile.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Versioning logic: map versions for files with identical names
    const nameCounts = new Map<string, number>();
    const formattedFiles = files.map((file) => {
      const baseName = file.fileName;
      const count = nameCounts.get(baseName) ?? 0;
      const version = count + 1;
      nameCounts.set(baseName, version);

      return {
        id: file.id,
        caseId: file.caseId,
        fileName: file.fileName,
        fileType: file.fileType,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        uploadedBy: file.user?.fullName ?? 'معمل EDL',
        createdAt: file.createdAt,
        version: version, // Incremental versions tags
      };
    });

    return formattedFiles;
  }
}
