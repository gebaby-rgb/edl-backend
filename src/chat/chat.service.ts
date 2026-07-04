import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(
    senderId: string,
    caseId: string,
    data: { messageText: string; fileUrls?: string[] },
  ) {
    // Verify case exists
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    // Create message
    const msg = await this.prisma.caseMessage.create({
      data: {
        caseId,
        senderId,
        messageText: data.messageText,
      },
      include: {
        sender: {
          select: {
            fullName: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Create attachments if provided
    if (data.fileUrls && data.fileUrls.length > 0) {
      await this.prisma.attachment.createMany({
        data: data.fileUrls.map((url) => {
          const parts = url.split('/');
          const name = parts[parts.length - 1] || 'attachment.bin';
          return {
            messageId: msg.id,
            fileUrl: url,
            fileName: name,
            fileSize: 1024 * 1024 * 2, // Mock 2 MB
          };
        }),
      });
    }

    // Query full message payload with attachments
    return this.prisma.caseMessage.findUnique({
      where: { id: msg.id },
      include: {
        sender: {
          select: {
            fullName: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        attachments: true,
      },
    });
  }

  async getHistory(caseId: string) {
    return this.prisma.caseMessage.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            fullName: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        attachments: true,
      },
    });
  }

  async getSmartReplies(caseId: string) {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { status: true },
    });

    if (!caseRecord) {
      throw new NotFoundException('Case not found');
    }

    const statusCode = caseRecord.status.code;

    // Status-aware suggest replies inside Case Chat
    switch (statusCode) {
      case 'Draft':
        return {
          suggestions: [
            'جاري مراجعة الطلب قبل الإرسال.',
            'هل يمكنني إضافة ملف مسح آخر؟',
            'الرجاء التحقق من أبعاد المارجن.',
          ],
        };
      case 'Submitted':
        return {
          suggestions: [
            'شكراً، بانتظار مراجعة وقبول الحالة.',
            'الملفات مرفقة بالكامل بالطلب.',
            'متى يتم إرسال المقايسة وعرض السعر؟',
          ],
        };
      case 'Quoted':
        return {
          suggestions: [
            'تم اعتماد عرض السعر، يرجى البدء فوراً.',
            'أرجو تقليل التكلفة أو عمل خصم.',
            'يرجى مراجعة تفاصيل المقايسة المالية.',
          ],
        };
      case 'In Production':
        return {
          suggestions: [
            'متى يتوقع الانتهاء من مرحلة التصميم؟',
            'جاري المتابعة، شكراً لمجهودكم.',
            'هل تم البدء بالخرط الفعلي للزركونيا؟',
          ],
        };
      case 'Ready':
        return {
          suggestions: [
            'يرجى إرسال المندوب لتوصيل الحالة للعيادة.',
            'هل الفاتورة الضريبية جاهزة للاستلام؟',
            'ممتاز، شكراً لسرعة إنجاز الحالة.',
          ],
        };
      default:
        return {
          suggestions: [
            'شكراً لكم، سأتابع التفاصيل.',
            'جاري العمل والمتابعة.',
            'سأرد عليكم قريباً بخصوص هذا الأمر.',
          ],
        };
    }
  }
}
