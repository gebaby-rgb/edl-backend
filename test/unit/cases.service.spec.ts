import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CasesService } from '../../src/cases/cases.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockPrisma = () => ({
  doctor: { findUnique: jest.fn() },
  case: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  caseStatus: { findUnique: jest.fn() },
  caseFile: { createMany: jest.fn() },
  caseTimeline: { create: jest.fn() },
  material: { findMany: jest.fn() },
  shade: { findMany: jest.fn() },
  priority: { findMany: jest.fn() },
});

const mockNotifications = () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
});

const DRAFT_STATUS = { id: 'status-draft', code: 'Draft' };
const SUBMITTED_STATUS = { id: 'status-submitted', code: 'Submitted' };

const DOCTOR = { id: 'doctor-1', userId: 'user-1' };

const BASE_CREATE_DATA = {
  clinicId: 'clinic-1',
  patientReference: 'Patient A',
  toothSelection: [11, 12],
  shadeId: 'shade-1',
  materialId: 'material-1',
  priorityId: 'priority-1',
  dueDate: '2026-12-01',
  status: 'Draft' as const,
};

// ── Test Suite ────────────────────────────────────────────────────────────────
describe('CasesService', () => {
  let service: CasesService;
  let prisma: ReturnType<typeof mockPrisma>;
  let notifications: ReturnType<typeof mockNotifications>;

  beforeEach(async () => {
    prisma = mockPrisma();
    notifications = mockNotifications();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
  });

  // ── createCase ─────────────────────────────────────────────────────────────
  describe('createCase', () => {
    it('throws BadRequestException when no doctor profile exists for user', async () => {
      prisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.createCase('user-no-doctor', BASE_CREATE_DATA),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCase('user-no-doctor', BASE_CREATE_DATA),
      ).rejects.toThrow('Authenticated user is not registered as a Doctor');
    });

    it('throws BadRequestException when status=Submitted but no files attached', async () => {
      prisma.doctor.findUnique.mockResolvedValue(DOCTOR);

      await expect(
        service.createCase('user-1', { ...BASE_CREATE_DATA, status: 'Submitted', files: [] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCase('user-1', { ...BASE_CREATE_DATA, status: 'Submitted' }),
      ).rejects.toThrow('Cannot submit a case to EDL Lab without attaching scan files');
    });

    it('throws BadRequestException when status lookup code not found', async () => {
      prisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      prisma.caseStatus.findUnique.mockResolvedValue(null);

      await expect(
        service.createCase('user-1', BASE_CREATE_DATA),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a Draft case and returns it with correct EDL case number', async () => {
      prisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      prisma.caseStatus.findUnique.mockResolvedValue(DRAFT_STATUS);
      prisma.case.count.mockResolvedValue(40); // next will be 41
      const createdCase = { id: 'case-1', caseNumber: 'EDL-2026-00041' };
      prisma.case.create.mockResolvedValue(createdCase);
      prisma.caseTimeline.create.mockResolvedValue({});

      const result = await service.createCase('user-1', BASE_CREATE_DATA);

      expect(prisma.case.create).toHaveBeenCalledTimes(1);
      expect(prisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseNumber: 'EDL-2026-00041',
            doctorId: DOCTOR.id,
          }),
        }),
      );
      expect(result).toEqual(createdCase);
    });

    it('attaches files when status=Submitted with files provided', async () => {
      const files = [
        { fileName: 'scan.stl', fileType: 'model/stl', fileUrl: 'https://s3.test/scan.stl', fileSize: 1000 },
      ];
      prisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      prisma.caseStatus.findUnique.mockResolvedValue(SUBMITTED_STATUS);
      prisma.case.count.mockResolvedValue(0);
      prisma.case.create.mockResolvedValue({ id: 'case-1', caseNumber: 'EDL-2026-00001' });
      prisma.caseFile.createMany.mockResolvedValue({ count: 1 });
      prisma.caseTimeline.create.mockResolvedValue({});

      await service.createCase('user-1', { ...BASE_CREATE_DATA, status: 'Submitted', files });

      expect(prisma.caseFile.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ fileName: 'scan.stl' }),
          ]),
        }),
      );
    });

    it('sends notification when case is submitted', async () => {
      const files = [
        { fileName: 'scan.stl', fileType: 'model/stl', fileUrl: 'https://s3.test/scan.stl', fileSize: 1000 },
      ];
      prisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      prisma.caseStatus.findUnique.mockResolvedValue(SUBMITTED_STATUS);
      prisma.case.count.mockResolvedValue(0);
      prisma.case.create.mockResolvedValue({ id: 'case-1', caseNumber: 'EDL-2026-00001' });
      prisma.caseFile.createMany.mockResolvedValue({ count: 1 });
      prisma.caseTimeline.create.mockResolvedValue({});

      await service.createCase('user-1', { ...BASE_CREATE_DATA, status: 'Submitted', files });

      expect(notifications.sendNotification).toHaveBeenCalledTimes(1);
      expect(notifications.sendNotification).toHaveBeenCalledWith(
        'user-1',
        'تقديم حالة جديدة',
        expect.stringContaining('EDL-2026-00001'),
        'Case',
      );
    });
  });

  // ── updateCase ─────────────────────────────────────────────────────────────
  describe('updateCase', () => {
    it('throws NotFoundException when case does not exist', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCase('user-1', 'case-missing', { patientReference: 'B' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when case is not in Draft state', async () => {
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        status: SUBMITTED_STATUS,
      });

      await expect(
        service.updateCase('user-1', 'case-1', { patientReference: 'B' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateCase('user-1', 'case-1', { patientReference: 'B' }),
      ).rejects.toThrow('Cannot modify case parameters');
    });

    it('updates and returns case when in Draft state', async () => {
      prisma.case.findUnique.mockResolvedValue({ id: 'case-1', status: DRAFT_STATUS });
      const updated = { id: 'case-1', patientReference: 'Patient B' };
      prisma.case.update.mockResolvedValue(updated);

      const result = await service.updateCase('user-1', 'case-1', { patientReference: 'Patient B' });

      expect(prisma.case.update).toHaveBeenCalledTimes(1);
      expect(result).toEqual(updated);
    });
  });

  // ── submitCase ─────────────────────────────────────────────────────────────
  describe('submitCase', () => {
    const files = [
      { fileName: 'jaw.stl', fileType: 'model/stl', fileUrl: 'https://s3.test/jaw.stl', fileSize: 2000 },
    ];

    it('throws NotFoundException when case does not exist', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      await expect(
        service.submitCase('user-1', 'case-missing', { files }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when case is already submitted (not Draft)', async () => {
      prisma.case.findUnique.mockResolvedValue({ id: 'case-1', status: SUBMITTED_STATUS });

      await expect(
        service.submitCase('user-1', 'case-1', { files }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitCase('user-1', 'case-1', { files }),
      ).rejects.toThrow('Case has already been submitted');
    });

    it('throws BadRequestException when no files provided', async () => {
      prisma.case.findUnique.mockResolvedValue({ id: 'case-1', status: DRAFT_STATUS });

      await expect(
        service.submitCase('user-1', 'case-1', { files: [] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitCase('user-1', 'case-1', { files: [] }),
      ).rejects.toThrow('without attaching scan files');
    });

    it('successfully submits a Draft case with files and transitions to Submitted', async () => {
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        caseNumber: 'EDL-2026-00001',
        statusId: DRAFT_STATUS.id,
        status: DRAFT_STATUS,
      });
      prisma.caseStatus.findUnique.mockResolvedValue(SUBMITTED_STATUS);
      prisma.caseFile.createMany.mockResolvedValue({ count: 1 });
      const updated = { id: 'case-1', statusId: SUBMITTED_STATUS.id };
      prisma.case.update.mockResolvedValue(updated);
      prisma.caseTimeline.create.mockResolvedValue({});

      const result = await service.submitCase('user-1', 'case-1', { files });

      expect(prisma.caseFile.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { statusId: SUBMITTED_STATUS.id },
        }),
      );
      expect(result).toEqual(updated);
      expect(notifications.sendNotification).toHaveBeenCalledTimes(1);
    });
  });
});
