/**
 * Cases API Tests — uses NestJS TestingModule + supertest
 * Tests HTTP contract of the /cases endpoints against a mock CasesService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { CasesController } from '../../src/cases/cases.controller';
import { CasesService } from '../../src/cases/cases.service';
import { AuthGuard } from '@nestjs/passport';

// ── Auth bypass guard ──────────────────────────────────────────────────────
class MockAuthGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-doctor-1', role: 'Doctor' };
    return true;
  }
}

// ── CasesService mock ──────────────────────────────────────────────────────
const mockCasesService = {
  getLookups: jest.fn(),
  createCase: jest.fn(),
  updateCase: jest.fn(),
  submitCase: jest.fn(),
};

// ── Fixtures ──────────────────────────────────────────────────────────────
const VALID_CREATE_BODY = {
  clinicId: 'clinic-1',
  patientReference: 'Patient A',
  toothSelection: [11, 12],
  shadeId: 'shade-a1',
  materialId: 'mat-zirconia',
  priorityId: 'prio-standard',
  dueDate: '2026-12-15',
  status: 'Draft',
};

const MOCK_CASE = {
  id: 'case-001',
  caseNumber: 'EDL-2026-00001',
  statusId: 'st-draft',
};

// ── Suite ──────────────────────────────────────────────────────────────────
describe('CasesController (API)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [
        { provide: CasesService, useValue: mockCasesService },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /cases/lookups ──────────────────────────────────────────────────
  describe('GET /cases/lookups', () => {
    it('returns 200 with clinic/material/shade/priority lookups', async () => {
      mockCasesService.getLookups.mockResolvedValue({
        clinics: [{ id: 'c1', name: 'عيادة الشروق' }],
        materials: [{ id: 'm1', name: 'Zirconia' }],
        shades: [{ id: 's1', code: 'A1' }],
        priorities: [{ id: 'p1', name: 'Standard' }],
      });

      const res = await request(app.getHttpServer()).get('/cases/lookups');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clinics');
      expect(res.body).toHaveProperty('materials');
      expect(mockCasesService.getLookups).toHaveBeenCalledWith('user-doctor-1');
    });
  });

  // ── POST /cases ────────────────────────────────────────────────────────
  describe('POST /cases', () => {
    it('returns 201 and the created case for a valid Draft request', async () => {
      mockCasesService.createCase.mockResolvedValue(MOCK_CASE);

      const res = await request(app.getHttpServer())
        .post('/cases')
        .send(VALID_CREATE_BODY)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('caseNumber', 'EDL-2026-00001');
      expect(mockCasesService.createCase).toHaveBeenCalledWith(
        'user-doctor-1',
        expect.objectContaining({ clinicId: 'clinic-1' }),
      );
    });

    it('returns 400 when status=Submitted but no files (service throws)', async () => {
      mockCasesService.createCase.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)(
          'Cannot submit a case to EDL Lab without attaching scan files',
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/cases')
        .send({ ...VALID_CREATE_BODY, status: 'Submitted' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('scan files');
    });

    it('returns 400 when doctor profile missing (service throws)', async () => {
      mockCasesService.createCase.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)(
          'Authenticated user is not registered as a Doctor',
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/cases')
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
    });
  });

  // ── PUT /cases/:id ─────────────────────────────────────────────────────
  describe('PUT /cases/:id', () => {
    it('returns 200 and updated case for Draft case', async () => {
      mockCasesService.updateCase.mockResolvedValue({
        ...MOCK_CASE,
        patientReference: 'Patient B',
      });

      const res = await request(app.getHttpServer())
        .put('/cases/case-001')
        .send({ patientReference: 'Patient B' });

      expect(res.status).toBe(200);
      expect(res.body.patientReference).toBe('Patient B');
      expect(mockCasesService.updateCase).toHaveBeenCalledWith(
        'user-doctor-1',
        'case-001',
        expect.objectContaining({ patientReference: 'Patient B' }),
      );
    });

    it('returns 400 when trying to update a non-Draft case (service throws)', async () => {
      mockCasesService.updateCase.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)(
          'Cannot modify case parameters. Active case is already in production.',
        ),
      );

      const res = await request(app.getHttpServer())
        .put('/cases/case-001')
        .send({ patientReference: 'Patient C' });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /cases/:id/submit ─────────────────────────────────────────────
  describe('POST /cases/:id/submit', () => {
    const FILES = [
      { fileName: 'scan.stl', fileType: 'model/stl', fileUrl: 'https://s3.test/scan.stl', fileSize: 14800 },
    ];

    it('returns 201 and the updated case on successful submit', async () => {
      mockCasesService.submitCase.mockResolvedValue({
        id: 'case-001',
        caseNumber: 'EDL-2026-00001',
        statusId: 'st-submitted',
      });

      const res = await request(app.getHttpServer())
        .post('/cases/case-001/submit')
        .send({ files: FILES });

      expect(res.status).toBe(201);
      expect(mockCasesService.submitCase).toHaveBeenCalledWith(
        'user-doctor-1',
        'case-001',
        expect.objectContaining({ files: FILES }),
      );
    });

    it('returns 400 when case is not in Draft state (service throws)', async () => {
      mockCasesService.submitCase.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)('Case has already been submitted'),
      );

      const res = await request(app.getHttpServer())
        .post('/cases/case-001/submit')
        .send({ files: FILES });

      expect(res.status).toBe(400);
    });

    it('returns 400 when no files provided (service throws)', async () => {
      mockCasesService.submitCase.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)(
          'Cannot submit case to EDL Lab without attaching scan files',
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/cases/case-001/submit')
        .send({ files: [] });

      expect(res.status).toBe(400);
    });
  });
});
