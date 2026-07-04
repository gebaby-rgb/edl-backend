import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Simple in-memory store for OTP simulation (Phone -> OTP Code)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function requestOtp(req: Request, res: Response) {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Generate 6-digit OTP (for development, default to '123456', or random)
  const code = phone.includes('+2010') ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

  otpStore.set(phone, { code, expiresAt });

  console.log(`[SMS Gateway Simulate] OTP for ${phone} is: ${code}`);

  return res.status(200).json({
    message: 'OTP sent successfully (Simulated)',
    expires_in: 300
  });
}

export async function verifyOtp(req: Request, res: Response) {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  const stored = otpStore.get(phone);
  if (!stored) {
    return res.status(400).json({ error: 'No OTP requested for this phone number' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP code has expired' });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }

  // Clear OTP code
  otpStore.delete(phone);

  try {
    // Find user
    let user = await prisma.user.findUnique({
      where: { phone },
      include: { role: true }
    });

    // If user does not exist, auto-register as Doctor (or Assistant if specified)
    if (!user) {
      // Find Doctor role
      const defaultRole = await prisma.role.findFirst({
        where: { name: 'Doctor' }
      });
      
      if (!defaultRole) {
        return res.status(500).json({ error: 'System Roles not initialized. Run seeding.' });
      }

      const randomPass = Math.random().toString(36).substring(7);
      const passwordHash = await bcrypt.hash(randomPass, 10);

      user = await prisma.user.create({
        data: {
          phone,
          fullName: 'طبيب جديد',
          passwordHash,
          roleId: defaultRole.id
        },
        include: { role: true }
      });

      const doctorProfile = await prisma.doctor.create({
        data: {
          userId: user.id,
          specialization: 'General Practitioner'
        }
      });

      await prisma.clinic.create({
        data: {
          doctorId: doctorProfile.id,
          name: 'عيادة جديدة',
          address: 'أسيوط، مصر'
        }
      });
    }

    // Generate Tokens
    const jwtSecret = process.env.JWT_SECRET || 'edl_super_secret_jwt_key_2026_luxury_brand';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'edl_super_secret_refresh_key_2026_gold';

    const payload = {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role.name
    };

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d' });

    // Store Session
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role.name
      }
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }
}

export async function refreshSession(req: Request, res: Response) {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'edl_super_secret_refresh_key_2026_gold';

  try {
    const decoded: any = jwt.verify(refresh_token, refreshSecret);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify session in DB
    const sessions = await prisma.session.findMany({
      where: { userId: user.id }
    });

    let validSession = false;
    for (const session of sessions) {
      if (await bcrypt.compare(refresh_token, session.tokenHash)) {
        if (session.expiresAt > new Date()) {
          validSession = true;
        }
        break;
      }
    }

    if (!validSession) {
      return res.status(401).json({ error: 'Session expired or invalidated' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'edl_super_secret_jwt_key_2026_luxury_brand';
    const payload = {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role.name
    };

    const newAccessToken = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

    return res.status(200).json({
      access_token: newAccessToken
    });

  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}
