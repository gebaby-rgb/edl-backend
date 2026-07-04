import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export async function createQuotation(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params; // case ID
  const { total_amount, discount = 0, tax = 0, notes } = req.body;

  if (total_amount === undefined) {
    return res.status(400).json({ error: 'Total amount is required' });
  }

  try {
    const finalAmount = total_amount - discount + tax;

    // Check if quotation already exists
    const existing = await prisma.quotation.findUnique({ where: { caseId: id } });
    if (existing) {
      return res.status(400).json({ error: 'Quotation already exists for this case' });
    }

    const quotation = await prisma.quotation.create({
      data: {
        caseId: id,
        totalAmount: Number(total_amount),
        discount: Number(discount),
        tax: Number(tax),
        finalAmount: Number(finalAmount),
        status: 'Pending',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
        notes
      }
    });

    // Update case status to Quoted
    await prisma.case.update({
      where: { id },
      data: { status: 'Quoted' }
    });

    // Log to Timeline
    const userId = req.user?.id || '';
    await prisma.caseTimeline.create({
      data: {
        caseId: id,
        statusFrom: 'Under Review',
        statusTo: 'Quoted',
        changedBy: userId,
        notes: `تم إنشاء عرض السعر بقيمة ${finalAmount} جنيه مصري.`
      }
    });

    return res.status(201).json(quotation);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error while creating quotation' });
  }
}

export async function approveQuotation(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params; // case ID

  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const quote = await prisma.quotation.findUnique({ where: { caseId: id } });
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });

    if (quote.status === 'Approved') {
      return res.status(400).json({ error: 'Quotation already approved' });
    }

    // Update quotation status
    const updatedQuote = await prisma.quotation.update({
      where: { caseId: id },
      data: { status: 'Approved' }
    });

    // Update case status to In Production (or Approved)
    await prisma.case.update({
      where: { id },
      data: { status: 'In Production' }
    });

    // Create Invoice
    const invoiceNumber = `INV-${Date.now()}`;
    const invoice = await prisma.invoice.create({
      data: {
        caseId: id,
        quotationId: quote.id,
        invoiceNumber,
        totalAmount: quote.finalAmount,
        status: 'Unpaid',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // Due in 15 days
      }
    });

    // Create default invoice item representing quotation total
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'مستحقات تصنيع تركيبات أسنان حسب عرض السعر المعتمد',
        quantity: 1,
        unitPrice: quote.finalAmount,
        totalPrice: quote.finalAmount
      }
    });

    // Add Timeline
    await prisma.caseTimeline.create({
      data: {
        caseId: id,
        statusFrom: 'Quoted',
        statusTo: 'In Production',
        changedBy: userId,
        notes: 'تمت موافقة الطبيب على عرض السعر. جاري بدء الإنتاج.'
      }
    });

    return res.status(200).json({ quotation: updatedQuote, invoice });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error during quote approval' });
  }
}

export async function rejectQuotation(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const userId = req.user?.id || '';
    const quote = await prisma.quotation.findUnique({ where: { caseId: id } });
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });

    const updatedQuote = await prisma.quotation.update({
      where: { caseId: id },
      data: { status: 'Rejected', notes: notes || 'تم رفض العرض من الطبيب' }
    });

    // Set case status back to Under Review for correction
    await prisma.case.update({
      where: { id },
      data: { status: 'Under Review' }
    });

    // Add Timeline
    await prisma.caseTimeline.create({
      data: {
        caseId: id,
        statusFrom: 'Quoted',
        statusTo: 'Under Review',
        changedBy: userId,
        notes: `تم رفض عرض السعر من الطبيب. السبب: ${notes || 'غير محدد'}`
      }
    });

    return res.status(200).json(updatedQuote);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error rejecting quotation' });
  }
}

export async function getInvoices(req: AuthenticatedRequest, res: Response) {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { case: true, items: true, payments: true }
    });
    return res.status(200).json(invoices);
  } catch (error: any) {
    return res.status(500).json({ error: 'Error fetching invoices' });
  }
}

export async function addPayment(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params; // Invoice ID
  const { amount, payment_method, transaction_reference } = req.body;

  if (!amount || !payment_method) {
    return res.status(400).json({ error: 'Amount and payment method are required' });
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        invoiceId: id,
        amount: Number(amount),
        paymentMethod: payment_method,
        transactionReference: transaction_reference,
        status: 'Pending'
      }
    });

    return res.status(201).json(payment);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error logging payment' });
  }
}
