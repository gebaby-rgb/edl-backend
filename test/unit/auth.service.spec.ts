import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppLogger } from '../../src/logger/logger.service';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockPrisma = () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
  role: { findFirst: jest.fn() },
  doctor: { create: jest.fn() },
  clinic: { create: jest.fn() },
  session: { create: jest.fn(), findMany: jest.fn() },
});

const mockJwtService = () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
});

const mockLogger = () => ({
  setContext: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
});

const DOCTOR_ROLE = { id: 'role-doctor', name: 'Doctor' };

const EXISTING_USER = {
  id: 'user-1',
  phone: '+201012345678',
  fullName: 'Dr. Ahmed',
  isActive: true,
  role: DOCTOR_ROLE,
};

// ── Suite ──────────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof mockPrisma>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    jwtService = mockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AppLogger, useValue: mockLogger() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── requestOtp ─────────────────────────────────────────────────────────────
  describe('requestOtp', () => {
    it('throws BadRequestException when phone is empty', async () => {
      await expect(service.requestOtp('')).rejects.toThrow(BadRequestException);
      await expect(service.requestOtp('')).rejects.toThrow('Phone number is required');
    });

    it('returns success message and expiry for valid phone', async () => {
      const result = await service.requestOtp('+201012345678');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('expires_in', 300);
    });

    it('uses deterministic OTP code 123456 for +2010 numbers (dev convenience)', async () => {
      // Call requestOtp and then immediately verifyOtp with 123456
      await service.requestOtp('+201099998888');
      // Should succeed since 123456 is the predictable OTP for +2010 numbers
      prisma.user.findUnique.mockResolvedValue(EXISTING_USER);
      prisma.session.create.mockResolvedValue({});

      const verifyResult = await service.verifyOtp('+201099998888', '123456');
      expect(verifyResult).toHaveProperty('access_token');
    });
  });

  // ── verifyOtp ──────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    it('throws BadRequestException when phone or code is missing', async () => {
      await expect(service.verifyOtp('', '123456')).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp('+201012345678', '')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no OTP was requested for that phone', async () => {
      await expect(
        service.verifyOtp('+201099999999', '123456'),
      ).rejects.toThrow('No OTP requested for this phone number');
    });

    it('throws BadRequestException when OTP code is incorrect', async () => {
      await service.requestOtp('+201012345678');

      await expect(
        service.verifyOtp('+201012345678', '000000'), // wrong code
      ).rejects.toThrow('Invalid OTP code');
    });

    it('returns access_token and refresh_token for existing user on correct OTP', async () => {
      await service.requestOtp('+201012345678');
      prisma.user.findUnique.mockResolvedValue(EXISTING_USER);
      prisma.session.create.mockResolvedValue({});

      const result = await service.verifyOtp('+201012345678', '123456');

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result).toHaveProperty('refresh_token', 'mock-jwt-token');
      expect(result.user).toMatchObject({
        id: EXISTING_USER.id,
        phone: EXISTING_USER.phone,
        role: DOCTOR_ROLE.name,
      });
    });

    it('auto-registers new user as Doctor when phone not in DB', async () => {
      await service.requestOtp('+201055554444');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findFirst.mockResolvedValue(DOCTOR_ROLE);
      prisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        phone: '+201055554444',
        fullName: 'طبيب جديد',
        role: DOCTOR_ROLE,
        isActive: true,
      });
      prisma.doctor.create.mockResolvedValue({ id: 'doctor-new' });
      prisma.clinic.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      const result = await service.verifyOtp('+201055554444', '123456');

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(prisma.doctor.create).toHaveBeenCalledTimes(1);
      expect(prisma.clinic.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('access_token');
    });

    it('throws BadRequestException when system roles are not initialized (no Doctor role)', async () => {
      await service.requestOtp('+201055553333');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findFirst.mockResolvedValue(null); // Roles not seeded

      await expect(
        service.verifyOtp('+201055553333', '123456'),
      ).rejects.toThrow('System Roles not initialized');
    });
  });
});
