/**
 * Quotations API Tests
 * Tests HTTP contract of /cases/:id/quotation and /quotations/:id/accept|reject
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { QuotationsController } from '../../src/quotations/quotations.controller';
import { QuotationsService } from '../../src/quotations/quotations.service';
import { AuthGuard } from '@nestjs/passport';

class MockAuthGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-admin-1', role: 'Laboratory Admin' };
    return true;
  }
}

const mockQuotationsService = {
  createQuotation: jest.fn(),
  getQuotation: jest.fn(),
  acceptQuotation: jest.fn(),
  rejectQuotation: jest.fn(),
  validateProductionGate: jest.fn(),
};

const MOCK_QUOTE = {
  id: 'quote-001',
  caseId: 'case-001',
  totalAmount: 2000,
  discount: 200,
  tax: 150,
  finalAmount: 1950,
  status: 'Pending',
  validUntil: '2026-12-22T00:00:00.000Z',
};

describe('QuotationsController (API)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotationsController],
      providers: [
        { provide: QuotationsService, useValue: mockQuotationsService },
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

  // ── POST /cases/:caseId/quotation ─────────────────────────────────────
  describe('POST /cases/:caseId/quotation', () => {
    const VALID_QUOTE_BODY = {
      totalAmount: 2000,
      discount: 200,
      tax: 150,
      validUntil: '2026-12-22',
      notes: 'تركيبة زيركون كاملة',
    };

    it('returns 201 and the created quotation', async () => {
      mockQuotationsService.createQuotation.mockResolvedValue(MOCK_QUOTE);

      const res = await request(app.getHttpServer())
        .post('/cases/case-001/quotation')
        .send(VALID_QUOTE_BODY);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'quote-001');
      expect(res.body).toHaveProperty('finalAmount', 1950);
      expect(mockQuotationsService.createQuotation).toHaveBeenCalledWith(
        'user-admin-1',
        'case-001',
        expect.objectContaining({ totalAmount: 2000 }),
      );
    });

    it('returns 400 when case is not in a valid state for pricing', async () => {
      mockQuotationsService.createQuotation.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)('Case is not in a valid state for pricing'),
      );

      const res = await request(app.getHttpServer())
        .post('/cases/case-001/quotation')
        .send(VALID_QUOTE_BODY);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('valid state for pricing');
    });

    it('returns 400 when finalAmount would be negative', async () => {
      mockQuotationsService.createQuotation.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)('Final quotation amount cannot be negative'),
      );

      const res = await request(app.getHttpServer())
        .post('/cases/case-001/quotation')
        .send({ ...VALID_QUOTE_BODY, discount: 999999 });

      expect(res.status).toBe(400);
    });

    it('returns 404 when case does not exist', async () => {
      mockQuotationsService.createQuotation.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Case not found'),
      );

      const res = await request(app.getHttpServer())
        .post('/cases/missing-case/quotation')
        .send(VALID_QUOTE_BODY);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /quotations/:quoteId/accept ──────────────────────────────────
  describe('POST /quotations/:quoteId/accept', () => {
    it('returns 200 with acceptance confirmation message', async () => {
      mockQuotationsService.acceptQuotation.mockResolvedValue({
        message: 'Quotation accepted, case locked and invoice generated successfully.',
      });

      const res = await request(app.getHttpServer())
        .post('/quotations/quote-001/accept');

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('invoice generated');
      expect(mockQuotationsService.acceptQuotation).toHaveBeenCalledWith(
        'user-admin-1',
        'quote-001',
      );
    });

    it('returns 400 when quotation already processed', async () => {
      mockQuotationsService.acceptQuotation.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)('Quotation is already processed'),
      );

      const res = await request(app.getHttpServer())
        .post('/quotations/quote-001/accept');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already processed');
    });

    it('returns 404 when quotation does not exist', async () => {
      mockQuotationsService.acceptQuotation.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Quotation not found'),
      );

      const res = await request(app.getHttpServer())
        .post('/quotations/missing-quote/accept');

      expect(res.status).toBe(404);
    });
  });

  // ── POST /quotations/:quoteId/reject ──────────────────────────────────
  describe('POST /quotations/:quoteId/reject', () => {
    it('returns 200 with rejection confirmation message', async () => {
      mockQuotationsService.rejectQuotation.mockResolvedValue({
        message: 'Quotation rejected, case returned to review state.',
      });

      const res = await request(app.getHttpServer())
        .post('/quotations/quote-001/reject');

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('review state');
    });

    it('returns 400 when quotation already processed', async () => {
      mockQuotationsService.rejectQuotation.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)('Quotation is already processed'),
      );

      const res = await request(app.getHttpServer())
        .post('/quotations/quote-001/reject');

      expect(res.status).toBe(400);
    });

    it('returns 404 when quotation does not exist', async () => {
      mockQuotationsService.rejectQuotation.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Quotation not found'),
      );

      const res = await request(app.getHttpServer())
        .post('/quotations/missing-quote/reject');

      expect(res.status).toBe(404);
    });
  });
});
