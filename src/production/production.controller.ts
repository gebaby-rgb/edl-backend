import { Controller, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductionService } from './production.service';
import { AssignTechnicianDto, UpdateStageDto } from './dto/production.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('production')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('cases/:id')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('stages')
  @ApiOperation({ summary: 'Get production stages for a specific case' })
  @ApiParam({ name: 'id', description: 'UUID of the case' })
  @ApiResponse({ status: 200, description: 'Stages returned successfully' })
  async getProductionStages(@Param('id') caseId: string) {
    return this.productionService.getProductionStages(caseId);
  }

  @Patch('technician')
  @ApiOperation({ summary: 'Assign a technician to a case production stage' })
  @ApiParam({ name: 'id', description: 'UUID of the case' })
  @ApiBody({ type: AssignTechnicianDto })
  @ApiResponse({ status: 200, description: 'Technician assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or case state' })
  async assignTechnician(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: AssignTechnicianDto,
  ) {
    const userId = req.user.id;
    return this.productionService.assignTechnician(userId, caseId, body.stageId, body.technicianId);
  }

  @Patch('stage')
  @ApiOperation({ summary: 'Update status of a case production stage' })
  @ApiParam({ name: 'id', description: 'UUID of the case' })
  @ApiBody({ type: UpdateStageDto })
  @ApiResponse({ status: 200, description: 'Stage status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or transition failure' })
  async updateStageStatus(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: UpdateStageDto,
  ) {
    const userId = req.user.id;
    return this.productionService.updateStageStatus(
      userId,
      caseId,
      body.stageId,
      body.status,
      body.qualityScore,
      body.qualityNotes,
    );
  }
}
