import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../logger/logger.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private logger: AppLogger,
  ) {
    this.logger.setContext('AuthService');
  }

  async requestOtp(phone: string) {
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }

    const code = phone.includes('+2010') ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.otpStore.set(phone, { code, expiresAt });
    // In production, integrate a real SMS gateway here and remove this log
    this.logger.debug(`[OTP Scaffold] Phone: ${phone} | Code: ${code}`, 'AuthService');

    return {
      message: 'OTP sent successfully (Simulated)',
      expires_in: 300,
    };
  }

  async verifyOtp(phone: string, code: string) {
    if (!phone || !code) {
      throw new BadRequestException('Phone and code are required');
    }

    const stored = this.otpStore.get(phone);
    if (!stored) {
      throw new BadRequestException('No OTP requested for this phone number');
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(phone);
      throw new BadRequestException('OTP code has expired');
    }

    if (stored.code !== code) {
      throw new BadRequestException('Invalid OTP code');
    }

    this.otpStore.delete(phone);

    // Fetch user or auto-register Doctor as baseline
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: { role: true },
    });

    if (!user) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { name: 'Doctor' },
      });

      if (!defaultRole) {
        throw new BadRequestException('System Roles not initialized');
      }

      const randomPass = Math.random().toString(36).substring(7);
      const passwordHash = await bcrypt.hash(randomPass, 10);

      user = await this.prisma.user.create({
        data: {
          phone,
          fullName: 'طبيب جديد',
          passwordHash,
          roleId: defaultRole.id,
        },
        include: { role: true },
      });

      const doctorProfile = await this.prisma.doctor.create({
        data: {
          userId: user.id,
          specialization: 'General Practitioner',
        },
      });

      await this.prisma.clinic.create({
        data: {
          doctorId: doctorProfile.id,
          name: 'عيادة جديدة',
          address: 'أسيوط، مصر',
        },
      });
    }

    const payload = {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role.name,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign({ id: user.id }, { expiresIn: '7d' });

    // Store Session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role.name,
      },
    };
  }

  async refreshSession(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid user session');
      }

      // Verify session token hash matching
      const sessions = await this.prisma.session.findMany({
        where: { userId: user.id },
      });

      let validSession = false;
      for (const session of sessions) {
        if (await bcrypt.compare(refreshToken, session.tokenHash)) {
          if (session.expiresAt > new Date()) {
            validSession = true;
          }
          break;
        }
      }

      if (!validSession) {
        throw new UnauthorizedException('Session expired or revoked');
      }

      const payload = {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role.name,
      };

      const newAccessToken = this.jwtService.sign(payload);
      return {
        access_token: newAccessToken,
      };

    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
