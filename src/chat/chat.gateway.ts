import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { AppLogger } from '../logger/logger.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private logger: AppLogger,
  ) {
    this.logger.setContext('ChatGateway');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract bearer token from query or auth headers
      const token = (client.handshake.query.token as string) || 
                    client.handshake.headers['authorization']?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'edl_super_secret_jwt_key_2026_luxury_brand',
      });
      client.data.user = decoded;
      this.logger.log(`WS connected: ${decoded.fullName} (${decoded.role}) [${client.id}]`);
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() caseId: string) {
    client.join(caseId);
    this.logger.debug(`WS room join: ${client.data.user?.fullName} → room ${caseId}`);
    return { event: 'roomJoined', data: caseId };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { caseId: string; messageText: string; fileUrls?: string[] },
  ) {
    const user = client.data.user;
    if (!user) return;

    // Save message via service
    const savedMsg = await this.chatService.saveMessage(user.id, payload.caseId, {
      messageText: payload.messageText,
      fileUrls: payload.fileUrls,
    });

    // Broadcast only to users joined inside this specific case room
    this.server.to(payload.caseId).emit('messageReceived', savedMsg);
  }
}
