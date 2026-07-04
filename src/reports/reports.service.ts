import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const totalCases = await this.prisma.case.count();
    
    // In Production lookup counts
    const activeProduction = await this.prisma.case.count({
      where: {
        status: {
          code: { in: ['In Production', 'Quality Control'] },
        },
      },
    });

    // Invoices aggregations
    const invoiceStats = await this.prisma.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
    });

    const paidInvoices = await this.prisma.invoice.aggregate({
      where: { status: 'Paid' },
      _sum: {
        totalAmount: true,
      },
    });

    const totalRevenue = invoiceStats._sum.totalAmount ?? 0;
    const collectedRevenue = paidInvoices._sum.totalAmount ?? 0;
    const pendingRevenue = totalRevenue - collectedRevenue;

    // Monthly curves (mocked list based on actual seeds)
    const monthlyRevenue = [
      { month: 'يناير', amount: totalRevenue * 0.15 },
      { month: 'فبراير', amount: totalRevenue * 0.20 },
      { month: 'مارس', amount: totalRevenue * 0.25 },
      { month: 'أبريل', amount: totalRevenue * 0.40 },
    ];

    // Case distributions by material
    const materials = await this.prisma.material.findMany({
      include: {
        _count: {
          select: { cases: true },
        },
      },
    });

    const materialDistribution = materials.map((m) => ({
      materialName: m.nameAr,
      caseCount: m._count.cases,
      percentage: totalCases > 0 ? (m._count.cases / totalCases) * 100 : 0,
    }));

    return {
      totalCases,
      activeProduction,
      totalRevenue,
      collectedRevenue,
      pendingRevenue,
      monthlyRevenue,
      materialDistribution,
    };
  }

  async getDoctorsActivity() {
    const doctors = await this.prisma.doctor.findMany({
      include: {
        user: {
          select: { fullName: true },
        },
        clinics: true,
        _count: {
          select: { cases: true },
        },
      },
      orderBy: {
        cases: { _count: 'desc' },
      },
    });

    return doctors.map((doc) => ({
      doctorId: doc.id,
      doctorName: doc.user.fullName,
      specialization: doc.specialization ?? 'عام',
      clinicCount: doc.clinics.length,
      caseCount: doc._count.cases,
    }));
  }
}
