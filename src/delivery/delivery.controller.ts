import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeliveryService } from './delivery.service';
import { ScheduleDeliveryDto, ConfirmDeliveryDto } from './dto/delivery.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('delivery')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('cases/:id/delivery')
  @ApiOperation({ summary: 'Schedule courier shipping for a completed case' })
  @ApiParam({ name: 'id', description: 'UUID of the case' })
  @ApiBody({ type: ScheduleDeliveryDto })
  @ApiResponse({ status: 201, description: 'Delivery order scheduled successfully' })
  @ApiResponse({ status: 400, description: 'Case not completed or invalid payload' })
  async scheduleDelivery(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: ScheduleDeliveryDto,
  ) {
    const userId = req.user.id;
    return this.deliveryService.scheduleDelivery(userId, caseId, body);
  }

  @Post('deliveries/:id/confirm')
  @ApiOperation({ summary: 'Doctor/Client confirms package receipt with signature' })
  @ApiParam({ name: 'id', description: 'UUID of the delivery order to confirm' })
  @ApiBody({ type: ConfirmDeliveryDto })
  @ApiResponse({ status: 200, description: 'Delivery receipt confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Delivery order already delivered or invalid payload' })
  async confirmDelivery(
    @Req() req: any,
    @Param('id') deliveryId: string,
    @Body() body: ConfirmDeliveryDto,
  ) {
    const userId = req.user.id;
    return this.deliveryService.confirmDelivery(userId, deliveryId, body);
  }
}
