import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuotationsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createQuotation(
    userId: string,
    caseId: string,
    data: { totalAmount: number; discount?: number; tax?: number; validUntil: string; notes?: string },
  ) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    if (caseRecord.status.code !== 'Submitted' && caseRecord.status.code !== 'Under Review') {
      throw new BadRequestException('Case is not in a valid state for pricing');
    }

    const discount = data.discount ?? 0;
    const tax = data.tax ?? 0;
    const finalAmount = data.totalAmount - discount + tax;
    if (finalAmount < 0) {
      throw new BadRequestException('Final quotation amount cannot be negative');
    }

    // Resolve Quoted status
    const quotedStatus = await this.prisma.caseStatus.findUnique({
      where: { code: 'Quoted' },
    });

    if (!quotedStatus) {
      throw new BadRequestException('Quoted status lookup not configured');
    }

    // Create Quotation
    const quote = await this.prisma.quotation.create({
      data: {
        caseId,
        totalAmount: data.totalAmount,
        discount,
        tax,
        finalAmount,
        status: 'Pending',
        validUntil: new Date(data.validUntil),
        notes: data.notes,
      },
    });

    // Update case status to Quoted
    await this.prisma.case.update({
      where: { id: caseId },
      data: { statusId: quotedStatus.id },
    });

    // Insert timeline log
    await this.prisma.caseTimeline.create({
      data: {
        caseId,
        statusFromId: caseRecord.statusId,
        statusToId: quotedStatus.id,
        changedBy: userId,
        notes: `تم إصدار عرض السعر بقيمة إجمالية ${finalAmount} ج.م.`,
      },
    });

    await this.notificationsService.sendNotification(
      userId,
      'عرض سعر جديد',
      `تم إصدار مقايسة مالية جديدة للحالة رقم ${caseRecord.caseNumber} بقيمة إجمالية ${finalAmount} ج.م.`,
      'Quote',
    );

    return quote;
  }

  async acceptQuotation(userId: string, quoteId: string) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id: quoteId },
      include: { case: { include: { status: true } } },
    });

    if (!quote) {
      throw new NotFoundException('Quotation not found');
    }

    if (quote.status !== 'Pending') {
      throw new BadRequestException('Quotation is already processed');
    }

    // Resolve Approved status
    const approvedStatus = await this.prisma.caseStatus.findUnique({
      where: { code: 'Approved' },
    });

    if (!approvedStatus) {
      throw new BadRequestException('Approved status lookup not configured');
    }

    // Update Quotation to Approved
    await this.prisma.quotation.update({
      where: { id: quoteId },
      data: { status: 'Approved' },
    });

    // Update Case to Approved (LOCKED)
    await this.prisma.case.update({
      where: { id: quote.caseId },
      data: { statusId: approvedStatus.id },
    });

    // Generate Invoice automatically
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `INV-2026-${(count + 1).toString().padStart(5, '0')}`;
    const invoice = await this.prisma.invoice.create({
      data: {
        caseId: quote.caseId,
        quotationId: quote.id,
        invoiceNumber,
        totalAmount: quote.finalAmount,
        status: 'Unpaid',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days net
      },
    });

    // Add Invoice Line Item
    await this.prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'تركيبات وتصميمات أسنان رقمية معمل EDL',
        quantity: 1,
        unitPrice: quote.finalAmount,
        totalPrice: quote.finalAmount,
      },
    });

    // Insert timeline log
    await this.prisma.caseTimeline.create({
      data: {
        caseId: quote.caseId,
        statusFromId: quote.case.statusId,
        statusToId: approvedStatus.id,
        changedBy: userId,
        notes: 'تم قبول عرض السعر من قبل العميل، ودخلت الحالة مرحلة الاعتماد.',
      },
    });

    await this.notificationsService.sendNotification(
      userId,
      'تم اعتماد المقايسة',
      `تم اعتماد قبول مقايسة الحالة رقم ${quote.case.caseNumber} وبدء مرحلة التصنيع.`,
      'Quote',
    );

    return { message: 'Quotation accepted, case locked and invoice generated successfully.' };
  }

  async rejectQuotation(userId: string, quoteId: string) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id: quoteId },
      include: { case: { include: { status: true } } },
    });

    if (!quote) {
      throw new NotFoundException('Quotation not found');
    }

    if (quote.status !== 'Pending') {
      throw new BadRequestException('Quotation is already processed');
    }

    const reviewStatus = await this.prisma.caseStatus.findUnique({
      where: { code: 'Under Review' },
    });

    if (!reviewStatus) {
      throw new BadRequestException('Under Review status lookup not configured');
    }

    // Update Quotation to Rejected
    await this.prisma.quotation.update({
      where: { id: quoteId },
      data: { status: 'Rejected' },
    });

    // Update Case to Under Review
    await this.prisma.case.update({
      where: { id: quote.caseId },
      data: { statusId: reviewStatus.id },
    });

    // Insert timeline log
    await this.prisma.caseTimeline.create({
      data: {
        caseId: quote.caseId,
        statusFromId: quote.case.statusId,
        statusToId: reviewStatus.id,
        changedBy: userId,
        notes: 'تم رفض عرض السعر من قبل العميل، وتجري مراجعة الحالة بالمعمل.',
      },
    });

    await this.notificationsService.sendNotification(
      userId,
      'رفض المقايسة',
      `تم رفض مقايسة الحالة رقم ${quote.case.caseNumber} وإعادتها للمراجعة بالمعمل.`,
      'Quote',
    );

    return { message: 'Quotation rejected, case returned to review state.' };
  }

  // Production Gate Check helper: returns true if case is approved
  async validateProductionGate(caseId: string) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    const validCodes = ['Approved', 'In Production', 'Quality Control', 'Ready'];
    if (!validCodes.includes(caseRecord.status.code)) {
      throw new BadRequestException('No production before approval: Case quotation has not been accepted by the clinic.');
    }

    return true;
  }
}
