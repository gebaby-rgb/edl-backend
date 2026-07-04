import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotationsService } from '../../src/quotations/quotations.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockPrisma = () => ({
  case: { findUnique: jest.fn(), update: jest.fn() },
  caseStatus: { findUnique: jest.fn() },
  quotation: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  caseTimeline: { create: jest.fn() },
  invoice: { count: jest.fn(), create: jest.fn() },
  invoiceItem: { create: jest.fn() },
});

const mockNotifications = () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
});

// ── Status Fixtures ────────────────────────────────────────────────────────
const STATUS_SUBMITTED   = { id: 'st-submitted',   code: 'Submitted' };
const STATUS_UNDER_REVIEW = { id: 'st-review',     code: 'Under Review' };
const STATUS_QUOTED      = { id: 'st-quoted',      code: 'Quoted' };
const STATUS_APPROVED    = { id: 'st-approved',    code: 'Approved' };

const CASE_SUBMITTED = {
  id: 'case-1',
  caseNumber: 'EDL-2026-00001',
  statusId: STATUS_SUBMITTED.id,
  status: STATUS_SUBMITTED,
};

const QUOTE_PENDING = {
  id: 'quote-1',
  caseId: 'case-1',
  totalAmount: 2000,
  discount: 200,
  tax: 150,
  finalAmount: 1950,
  status: 'Pending',
  case: { ...CASE_SUBMITTED, statusId: STATUS_QUOTED.id, status: STATUS_QUOTED },
};

// ── Suite ──────────────────────────────────────────────────────────────────
describe('QuotationsService', () => {
  let service: QuotationsService;
  let prisma: ReturnType<typeof mockPrisma>;
  let notifications: ReturnType<typeof mockNotifications>;

  beforeEach(async () => {
    prisma = mockPrisma();
    notifications = mockNotifications();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  // ── createQuotation ───────────────────────────────────────────────────────
  describe('createQuotation', () => {
    const QUOTE_DATA = {
      totalAmount: 2000,
      discount: 200,
      tax: 150,
      validUntil: '2026-12-31',
    };

    it('throws NotFoundException when case does not exist', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      await expect(
        service.createQuotation('admin-1', 'missing-case', QUOTE_DATA),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when case is not in Submitted or Under Review state', async () => {
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        status: STATUS_APPROVED,
      });

      await expect(
        service.createQuotation('admin-1', 'case-1', QUOTE_DATA),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createQuotation('admin-1', 'case-1', QUOTE_DATA),
      ).rejects.toThrow('not in a valid state for pricing');
    });

    it('throws BadRequestException when finalAmount is negative', async () => {
      prisma.case.findUnique.mockResolvedValue({ id: 'case-1', status: STATUS_SUBMITTED });

      await expect(
        service.createQuotation('admin-1', 'case-1', {
          totalAmount: 100,
          discount: 500,  // discount > total → negative final
          tax: 0,
          validUntil: '2026-12-31',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createQuotation('admin-1', 'case-1', {
          totalAmount: 100,
          discount: 500,
          tax: 0,
          validUntil: '2026-12-31',
        }),
      ).rejects.toThrow('cannot be negative');
    });

    it('correctly computes finalAmount = total - discount + tax', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...CASE_SUBMITTED });
      prisma.caseStatus.findUnique.mockResolvedValue(STATUS_QUOTED);
      const createdQuote = { id: 'quote-1', finalAmount: 1950 };
      prisma.quotation.create.mockResolvedValue(createdQuote);
      prisma.case.update.mockResolvedValue({});
      prisma.caseTimeline.create.mockResolvedValue({});

      const result = await service.createQuotation('admin-1', 'case-1', QUOTE_DATA);

      expect(prisma.quotation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            finalAmount: 1950,  // 2000 - 200 + 150
          }),
        }),
      );
      expect(result).toEqual(createdQuote);
    });

    it('advances case status to Quoted after creating quotation', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...CASE_SUBMITTED });
      prisma.caseStatus.findUnique.mockResolvedValue(STATUS_QUOTED);
      prisma.quotation.create.mockResolvedValue({ id: 'quote-1', finalAmount: 1950 });
      prisma.case.update.mockResolvedValue({});
      prisma.caseTimeline.create.mockResolvedValue({});

      await service.createQuotation('admin-1', 'case-1', QUOTE_DATA);

      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { statusId: STATUS_QUOTED.id },
        }),
      );
    });

    it('sends notification to user after creating quotation', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...CASE_SUBMITTED });
      prisma.caseStatus.findUnique.mockResolvedValue(STATUS_QUOTED);
      prisma.quotation.create.mockResolvedValue({ id: 'quote-1', finalAmount: 1950 });
      prisma.case.update.mockResolvedValue({});
      prisma.caseTimeline.create.mockResolvedValue({});

      await service.createQuotation('admin-1', 'case-1', QUOTE_DATA);

      expect(notifications.sendNotification).toHaveBeenCalledWith(
        'admin-1',
        'عرض سعر جديد',
        expect.stringContaining('1950'),
        'Quote',
      );
    });
  });

  // ── acceptQuotation ───────────────────────────────────────────────────────
  describe('acceptQuotation', () => {
    it('throws NotFoundException when quotation does not exist', async () => {
      prisma.quotation.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptQuotation('doctor-1', 'missing-quote'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when quotation is already processed', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...QUOTE_PENDING,
        status: 'Approved', // already accepted
      });

      await expect(
        service.acceptQuotation('doctor-1', 'quote-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.acceptQuotation('doctor-1', 'quote-1'),
      ).rejects.toThrow('already processed');
    });

    it('sets quotation to Approved, case to Approved, and creates invoice', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ ...QUOTE_PENDING });
      prisma.caseStatus.findUnique.mockResolvedValue(STATUS_APPROVED);
      prisma.quotation.update.mockResolvedValue({});
      prisma.case.update.mockResolvedValue({});
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2026-00001' });
      prisma.invoiceItem.create.mockResolvedValue({});
      prisma.caseTimeline.create.mockResolvedValue({});

      const result = await service.acceptQuotation('doctor-1', 'quote-1');

      // Quotation → Approved
      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'Approved' } }),
      );
      // Case → Approved (LOCKED)
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { statusId: STATUS_APPROVED.id } }),
      );
      // Invoice auto-generated
      expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
      expect(prisma.invoiceItem.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('message');
    });
  });

  // ── rejectQuotation ───────────────────────────────────────────────────────
  describe('rejectQuotation', () => {
    it('throws NotFoundException when quotation not found', async () => {
      prisma.quotation.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectQuotation('doctor-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns case to Under Review state on rejection', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ ...QUOTE_PENDING });
      prisma.caseStatus.findUnique.mockResolvedValue(STATUS_UNDER_REVIEW);
      prisma.quotation.update.mockResolvedValue({});
      prisma.case.update.mockResolvedValue({});
      prisma.caseTimeline.create.mockResolvedValue({});

      const result = await service.rejectQuotation('doctor-1', 'quote-1');

      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'Rejected' } }),
      );
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { statusId: STATUS_UNDER_REVIEW.id } }),
      );
      expect(result).toHaveProperty('message');
    });
  });

  // ── validateProductionGate ─────────────────────────────────────────────────
  describe('validateProductionGate', () => {
    it('throws BadRequestException when case is not Approved/In Production/QC/Ready', async () => {
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        status: STATUS_QUOTED, // not yet approved
      });

      await expect(
        service.validateProductionGate('case-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateProductionGate('case-1'),
      ).rejects.toThrow('No production before approval');
    });

    it('returns true when case is Approved', async () => {
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        status: STATUS_APPROVED,
      });

      const result = await service.validateProductionGate('case-1');
      expect(result).toBe(true);
    });

    it('returns true when case is In Production', async () => {
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        status: { id: 'st-prod', code: 'In Production' },
      });

      const result = await service.validateProductionGate('case-1');
      expect(result).toBe(true);
    });
  });
});
