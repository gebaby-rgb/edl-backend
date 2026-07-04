/**
 * EDL Critical Flow — E2E State Machine Test
 *
 * Tests the complete lifecycle of a dental lab case:
 *   Case(Draft) → Submit(files) → Quote(Pending) → Accept(Approved)
 *   → Production(Modeling→Fabrication→Finishing→QC) → Ready → Delivery → Delivered
 *
 * Uses mocked PrismaService + NotificationsService so no real DB is required.
 * Each step verifies service calls + state transitions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CasesService } from '../../src/cases/cases.service';
import { QuotationsService } from '../../src/quotations/quotations.service';
import { ProductionService } from '../../src/production/production.service';
import { DeliveryService } from '../../src/delivery/delivery.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

// ── Mock Factory ───────────────────────────────────────────────────────────
function buildPrismaMock() {
  return {
    doctor:          { findUnique: jest.fn() },
    case:            { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    caseStatus:      { findUnique: jest.fn() },
    caseFile:        { createMany: jest.fn() },
    caseTimeline:    { create: jest.fn() },
    quotation:       { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    invoice:         { count: jest.fn(), create: jest.fn() },
    invoiceItem:     { create: jest.fn() },
    productionStage: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
    technician:      { findUnique: jest.fn(), update: jest.fn() },
    deliveryOrder:   { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

// ── Status fixtures shared across all steps ────────────────────────────────
const S_DRAFT        = { id: 'st-1', code: 'Draft' };
const S_SUBMITTED    = { id: 'st-2', code: 'Submitted' };
const S_QUOTED       = { id: 'st-3', code: 'Quoted' };
const S_APPROVED     = { id: 'st-4', code: 'Approved' };
const S_IN_PROD      = { id: 'st-5', code: 'In Production' };
const S_READY        = { id: 'st-6', code: 'Ready' };
const S_SHIPPED      = { id: 'st-7', code: 'Shipped' };
const S_DELIVERED    = { id: 'st-8', code: 'Delivered' };

const DOCTOR_1 = { id: 'doctor-1', userId: 'user-doctor-1' };
const ADMIN_1  = 'user-admin-1';
const USER_D   = 'user-doctor-1';

const SCAN_FILES = [
  { fileName: 'upper_jaw.stl', fileType: 'model/stl', fileUrl: 'https://s3.edl-lab.com/scans/upper_jaw.stl', fileSize: 14800 },
  { fileName: 'lower_jaw.stl', fileType: 'model/stl', fileUrl: 'https://s3.edl-lab.com/scans/lower_jaw.stl', fileSize: 12300 },
];

const STAGE_TYPES = [
  { id: 'stype-1', code: 'Modeling',    nameAr: 'النمذجة',    nameEn: 'Modeling',    sequenceOrder: 1 },
  { id: 'stype-2', code: 'Fabrication', nameAr: 'التصنيع',    nameEn: 'Fabrication', sequenceOrder: 2 },
  { id: 'stype-3', code: 'Finishing',   nameAr: 'التشطيب',    nameEn: 'Finishing',   sequenceOrder: 3 },
  { id: 'stype-4', code: 'QC',          nameAr: 'فحص الجودة', nameEn: 'QC',          sequenceOrder: 4 },
];

// ── E2E Suite ──────────────────────────────────────────────────────────────
describe('EDL Critical Flow — E2E Case Lifecycle', () => {
  let casesService: CasesService;
  let quotationsService: QuotationsService;
  let productionService: ProductionService;
  let deliveryService: DeliveryService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  // Shared state across steps (accumulated through the test)
  let caseId: string;
  let quoteId: string;
  let stageIds: string[];
  let deliveryId: string;

  beforeAll(async () => {
    prisma = buildPrismaMock();
    const notifications = { sendNotification: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        QuotationsService,
        ProductionService,
        DeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    casesService       = module.get(CasesService);
    quotationsService  = module.get(QuotationsService);
    productionService  = module.get(ProductionService);
    deliveryService    = module.get(DeliveryService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Create case as Draft
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 1 — Doctor creates a Draft case', async () => {
    caseId = 'case-edl-001';
    prisma.doctor.findUnique.mockResolvedValue(DOCTOR_1);
    prisma.caseStatus.findUnique.mockResolvedValue(S_DRAFT);
    prisma.case.count.mockResolvedValue(0);
    prisma.case.create.mockResolvedValue({ id: caseId, caseNumber: 'EDL-2026-00001', statusId: S_DRAFT.id });
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await casesService.createCase(USER_D, {
      clinicId: 'clinic-1',
      patientReference: 'مريض أ - تجربة',
      toothSelection: [11, 12, 13, 21],
      shadeId: 'shade-a1',
      materialId: 'material-zirconia',
      priorityId: 'priority-standard',
      dueDate: '2026-12-15',
      status: 'Draft',
    });

    expect(result.id).toBe(caseId);
    expect(result.caseNumber).toBe('EDL-2026-00001');
    expect(prisma.case.create).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Submit case with scan files → status = Submitted
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 2 — Doctor submits case with STL scan files', async () => {
    prisma.case.findUnique.mockResolvedValue({
      id: caseId,
      caseNumber: 'EDL-2026-00001',
      statusId: S_DRAFT.id,
      status: S_DRAFT,
    });
    prisma.caseStatus.findUnique.mockResolvedValue(S_SUBMITTED);
    prisma.caseFile.createMany.mockResolvedValue({ count: 2 });
    prisma.case.update.mockResolvedValue({ id: caseId, statusId: S_SUBMITTED.id });
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await casesService.submitCase(USER_D, caseId, { files: SCAN_FILES });

    expect(prisma.caseFile.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.caseFile.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ fileName: 'upper_jaw.stl' }),
          expect.objectContaining({ fileName: 'lower_jaw.stl' }),
        ]),
      }),
    );
    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_SUBMITTED.id } }),
    );
    expect(result.statusId).toBe(S_SUBMITTED.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Admin creates quotation → case status = Quoted
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 3 — Admin creates a quotation for the submitted case', async () => {
    quoteId = 'quote-edl-001';
    prisma.case.findUnique.mockResolvedValue({
      id: caseId,
      caseNumber: 'EDL-2026-00001',
      statusId: S_SUBMITTED.id,
      status: S_SUBMITTED,
    });
    prisma.caseStatus.findUnique.mockResolvedValue(S_QUOTED);
    prisma.quotation.create.mockResolvedValue({
      id: quoteId,
      caseId,
      totalAmount: 3500,
      discount: 500,
      tax: 250,
      finalAmount: 3250,
      status: 'Pending',
    });
    prisma.case.update.mockResolvedValue({});
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await quotationsService.createQuotation(ADMIN_1, caseId, {
      totalAmount: 3500,
      discount: 500,
      tax: 250,
      validUntil: '2026-12-22',
      notes: 'جراب زيركون كامل + تركيبات خزفية',
    });

    expect(result.id).toBe(quoteId);
    expect(result.finalAmount).toBe(3250); // 3500 - 500 + 250
    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_QUOTED.id } }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: Doctor accepts quotation → case LOCKED, status = Approved
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 4 — Doctor accepts the quotation and locks the case', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: quoteId,
      caseId,
      totalAmount: 3500,
      discount: 500,
      tax: 250,
      finalAmount: 3250,
      status: 'Pending',
      case: { id: caseId, caseNumber: 'EDL-2026-00001', statusId: S_QUOTED.id, status: S_QUOTED },
    });
    prisma.caseStatus.findUnique.mockResolvedValue(S_APPROVED);
    prisma.quotation.update.mockResolvedValue({});
    prisma.case.update.mockResolvedValue({});
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.create.mockResolvedValue({ id: 'inv-001', invoiceNumber: 'INV-2026-00001', totalAmount: 3250 });
    prisma.invoiceItem.create.mockResolvedValue({});
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await quotationsService.acceptQuotation(USER_D, quoteId);

    // Quotation set to Approved
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'Approved' } }),
    );
    // Case LOCKED at Approved
    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_APPROVED.id } }),
    );
    // Invoice auto-generated
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(result.message).toContain('invoice generated');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4b: Production gate blocks non-approved cases
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 4b — Production gate rejects cases that are not approved', async () => {
    prisma.case.findUnique.mockResolvedValue({
      id: 'other-case',
      status: S_QUOTED, // not approved
    });

    await expect(
      quotationsService.validateProductionGate('other-case'),
    ).rejects.toThrow('No production before approval');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: Start Modeling stage → case transitions to In Production
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 5 — Technician starts Modeling stage, case moves to In Production', async () => {
    stageIds = ['stage-modeling', 'stage-fabrication', 'stage-finishing', 'stage-qc'];

    const modelingStage = {
      id: stageIds[0],
      caseId,
      technicianId: 'tech-1',
      status: 'Pending',
      stageType: STAGE_TYPES[0], // sequenceOrder: 1
    };

    prisma.case.findUnique.mockResolvedValue({
      id: caseId,
      caseNumber: 'EDL-2026-00001',
      statusId: S_APPROVED.id,
      status: S_APPROVED,
    });
    prisma.productionStage.findUnique.mockResolvedValue(modelingStage);
    prisma.productionStage.findFirst.mockResolvedValue(null); // no prior incomplete stages
    prisma.productionStage.update.mockResolvedValue({});
    prisma.caseStatus.findUnique.mockResolvedValue(S_IN_PROD);
    prisma.case.update.mockResolvedValue({});
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await productionService.updateStageStatus(
      ADMIN_1, caseId, stageIds[0], 'InProgress',
    );

    expect(prisma.productionStage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'InProgress' }),
      }),
    );
    // Case → In Production (first stage start)
    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_IN_PROD.id } }),
    );
    expect(result.message).toContain('InProgress');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 6: Complete Modeling, start Fabrication (state machine enforced)
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 6 — State machine blocks Fabrication if Modeling not completed', async () => {
    const fabricationStage = {
      id: stageIds[1],
      caseId,
      technicianId: 'tech-2',
      status: 'Pending',
      stageType: STAGE_TYPES[1], // sequenceOrder: 2
    };

    prisma.case.findUnique.mockResolvedValue({
      id: caseId,
      status: S_IN_PROD,
      statusId: S_IN_PROD.id,
    });
    prisma.productionStage.findUnique.mockResolvedValue(fabricationStage);
    // Previous stage (Modeling) is still InProgress, not Completed
    prisma.productionStage.findFirst.mockResolvedValue({ id: stageIds[0], status: 'InProgress' });

    await expect(
      productionService.updateStageStatus(ADMIN_1, caseId, stageIds[1], 'InProgress'),
    ).rejects.toThrow('Must follow state machine strictly');
  });

  it('Step 6b — Completes Modeling then starts Fabrication', async () => {
    const fabricationStage = {
      id: stageIds[1],
      caseId,
      technicianId: 'tech-2',
      status: 'Pending',
      stageType: STAGE_TYPES[1],
    };

    // Complete Modeling
    prisma.case.findUnique.mockResolvedValue({ id: caseId, status: S_IN_PROD, statusId: S_IN_PROD.id });
    prisma.productionStage.findUnique.mockResolvedValue({
      id: stageIds[0], caseId, stageType: STAGE_TYPES[0], status: 'InProgress',
    });
    prisma.productionStage.update.mockResolvedValue({});
    prisma.productionStage.count.mockResolvedValue(3); // 3 stages remaining
    prisma.caseTimeline.create.mockResolvedValue({});

    await productionService.updateStageStatus(ADMIN_1, caseId, stageIds[0], 'Completed', 95, 'نمذجة ممتازة');

    // Start Fabrication
    prisma.productionStage.findUnique.mockResolvedValue(fabricationStage);
    prisma.productionStage.findFirst.mockResolvedValue(null); // Modeling now completed

    const result = await productionService.updateStageStatus(ADMIN_1, caseId, stageIds[1], 'InProgress');

    expect(result.message).toContain('InProgress');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 7: Complete all remaining stages → case transitions to Ready
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 7 — All production stages completed, case transitions to Ready', async () => {
    const qcStage = {
      id: stageIds[3],
      caseId,
      technicianId: 'tech-4',
      status: 'InProgress',
      stageType: STAGE_TYPES[3], // QC, sequenceOrder: 4
    };

    prisma.case.findUnique.mockResolvedValue({ id: caseId, status: S_IN_PROD, statusId: S_IN_PROD.id });
    prisma.productionStage.findUnique.mockResolvedValue(qcStage);
    prisma.productionStage.update.mockResolvedValue({});
    // After completing QC, 0 remaining stages → case goes Ready
    prisma.productionStage.count.mockResolvedValue(0);
    prisma.caseStatus.findUnique.mockResolvedValue(S_READY);
    prisma.case.update.mockResolvedValue({ id: caseId, statusId: S_READY.id });
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await productionService.updateStageStatus(
      ADMIN_1, caseId, stageIds[3], 'Completed', 100, 'فحص الجودة اجتاز المعايير',
    );

    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_READY.id } }),
    );
    expect(result.message).toContain('Completed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 8: Schedule delivery → case transitions to Shipped
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 8 — Admin schedules delivery for the Ready case', async () => {
    deliveryId = 'delivery-001';

    prisma.case.findUnique.mockResolvedValue({
      id: caseId,
      caseNumber: 'EDL-2026-00001',
      statusId: S_READY.id,
      status: S_READY,
    });
    prisma.caseStatus.findUnique.mockResolvedValue(S_SHIPPED);
    prisma.deliveryOrder.upsert.mockResolvedValue({
      id: deliveryId,
      caseId,
      courierId: 'courier-1',
      status: 'Pending',
    });
    prisma.case.update.mockResolvedValue({});
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await deliveryService.scheduleDelivery(ADMIN_1, caseId, {
      courierId: 'courier-1',
      notes: 'تسليم قبل الساعة 5 مساءً لعيادة الدكتور',
    });

    expect(result.id).toBe(deliveryId);
    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_SHIPPED.id } }),
    );
  });

  it('Step 8b — Delivery cannot be scheduled if case is not Ready', async () => {
    prisma.case.findUnique.mockResolvedValue({
      id: caseId,
      status: S_IN_PROD, // still in production
    });

    await expect(
      deliveryService.scheduleDelivery(ADMIN_1, caseId, { courierId: 'courier-1' }),
    ).rejects.toThrow('Production stages must be completed first');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 9: Confirm delivery → case transitions to Delivered (FINAL STATE)
  // ──────────────────────────────────────────────────────────────────────────
  it('Step 9 — Doctor confirms receipt of delivery (FINAL STATE: Delivered)', async () => {
    prisma.deliveryOrder.findUnique.mockResolvedValue({
      id: deliveryId,
      caseId,
      status: 'Pending',
      case: {
        id: caseId,
        caseNumber: 'EDL-2026-00001',
        statusId: S_SHIPPED.id,
        status: S_SHIPPED,
      },
    });
    prisma.caseStatus.findUnique.mockResolvedValue(S_DELIVERED);
    prisma.deliveryOrder.update.mockResolvedValue({ id: deliveryId, status: 'Delivered' });
    prisma.case.update.mockResolvedValue({ id: caseId, statusId: S_DELIVERED.id });
    prisma.caseTimeline.create.mockResolvedValue({});

    const result = await deliveryService.confirmDelivery(USER_D, deliveryId, {
      signatureUrl: 'https://storage.edl-lab.com/signatures/doctor_sign.png',
    });

    expect(prisma.deliveryOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'Delivered' }),
      }),
    );
    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: S_DELIVERED.id } }),
    );
    expect(result.message).toContain('Delivered');
  });

  it('Step 9b — Cannot confirm delivery that is already confirmed', async () => {
    prisma.deliveryOrder.findUnique.mockResolvedValue({
      id: deliveryId,
      caseId,
      status: 'Delivered', // already confirmed
      case: { id: caseId, caseNumber: 'EDL-2026-00001', statusId: S_DELIVERED.id, status: S_DELIVERED },
    });

    await expect(
      deliveryService.confirmDelivery(USER_D, deliveryId, {}),
    ).rejects.toThrow('already confirmed');
  });
});
