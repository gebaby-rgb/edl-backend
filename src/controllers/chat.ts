import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateSmartReplies } from '../services/ai';

const prisma = new PrismaClient();

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const messages = await prisma.caseMessage.findMany({
      where: { caseId: id },
      include: { sender: { include: { role: true } } },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json({ messages });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error while fetching messages' });
  }
}

export async function postMessage(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { message_text } = req.body;

  if (!message_text) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const message = await prisma.caseMessage.create({
      data: {
        caseId: id,
        senderId: userId,
        messageText: message_text
      },
      include: { sender: { include: { role: true } } }
    });

    return res.status(201).json(message);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error while posting message' });
  }
}

export async function getAiSmartReplies(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const targetCase = await prisma.case.findUnique({
      where: { id }
    });

    if (!targetCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get last 10 messages for context
    const messages = await prisma.caseMessage.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Format messages for the AI model: "[Sender Name]: [Message Text]"
    // Since we queried desc, reverse it to get chronological order
    const formattedMessages = messages
      .reverse()
      .map(msg => `${msg.senderId === targetCase.doctorId ? 'Doctor' : 'Lab'}: ${msg.messageText}`);

    // Generate replies
    const suggestions = await generateSmartReplies(targetCase.status, formattedMessages);

    return res.status(200).json({ suggestions });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error generating AI smart replies' });
  }
}
