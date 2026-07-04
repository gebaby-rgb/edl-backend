import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/notifications.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices/register')
  @ApiOperation({ summary: 'Register FCM token for device notifications' })
  @ApiBody({ type: RegisterDeviceDto })
  @ApiResponse({ status: 201, description: 'Device token registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async registerDevice(
    @Req() req: any,
    @Body() body: RegisterDeviceDto,
  ) {
    const userId = req.user.id;
    return this.notificationsService.registerDevice(userId, body);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification log history for the current user' })
  @ApiResponse({ status: 200, description: 'List of notifications returned successfully' })
  async getUserNotifications(@Req() req: any): Promise<any[]> {
    const userId = req.user.id;
    return this.notificationsService.getUserNotifications(userId);
  }
}
