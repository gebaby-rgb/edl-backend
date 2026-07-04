import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';

@Controller('cases/:id')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  async getHistory(@Param('id') caseId: string) {
    return this.chatService.getHistory(caseId);
  }

  @Get('ai/replies')
  async getSmartReplies(@Param('id') caseId: string) {
    return this.chatService.getSmartReplies(caseId);
  }
}
