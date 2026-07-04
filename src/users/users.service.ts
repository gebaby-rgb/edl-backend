import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        doctor: {
          include: {
            clinics: true,
          },
        },
        technician: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Clean sensitive parameters
    const { passwordHash, ...cleanUser } = user;
    return cleanUser;
  }

  async updateProfile(
    userId: string,
    data: { fullName?: string; email?: string; specialization?: string; bio?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update base user details
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        email: data.email,
      },
    });

    // If role is Doctor, update specialization/bio in Doctor profile
    if (user.roleId) {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId },
      });

      if (doctorProfile) {
        await this.prisma.doctor.update({
          where: { userId },
          data: {
            specialization: data.specialization,
            bio: data.bio,
          },
        });
      }
    }

    return this.getProfile(userId);
  }
}
