import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'edl_super_secret_jwt_key_2026_luxury_brand',
    });
  }

  async validate(payload: { id: string; phone: string; fullName: string; role: string }) {
    // Confirm user active state in DB
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is disabled or inactive');
    }

    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role.name,
    };
  }
}
