import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('Laboratory Admin', 'Owner') // Restrict reporting to lab admins/owners
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get total dashboard and revenue metrics (Admin/Owner only)' })
  @ApiResponse({ status: 200, description: 'Reporting stats returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden role access' })
  async getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('doctors')
  @ApiOperation({ summary: 'Get summary of doctor transaction counts and values (Admin/Owner only)' })
  @ApiResponse({ status: 200, description: 'Doctors activity stats returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden role access' })
  async getDoctorsActivity() {
    return this.reportsService.getDoctorsActivity();
  }
}
