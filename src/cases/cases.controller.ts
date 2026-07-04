import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CasesService } from './cases.service';
import { CreateCaseDto, UpdateCaseDto, SubmitCaseDto } from './dto/cases.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('cases')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get('lookups')
  @ApiOperation({ summary: 'Get active lookup lists (materials, shades, priorities, statuses)' })
  @ApiResponse({ status: 200, description: 'Lookups returned successfully' })
  async getLookups(@Req() req: any) {
    const userId = req.user.id;
    return this.casesService.getLookups(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of cases for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Cases list returned successfully' })
  async getCases(@Req() req: any) {
    const userId = req.user.id;
    return this.casesService.getCases(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new case (Draft or Submitted)' })
  @ApiBody({ type: CreateCaseDto })
  @ApiResponse({ status: 201, description: 'Case created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async createCase(@Req() req: any, @Body() body: CreateCaseDto) {
    const userId = req.user.id;
    return this.casesService.createCase(userId, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update case specifications (only permitted in Draft status)' })
  @ApiParam({ name: 'id', description: 'UUID of the case to update' })
  @ApiBody({ type: UpdateCaseDto })
  @ApiResponse({ status: 200, description: 'Case updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or case locked' })
  async updateCase(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCaseDto,
  ) {
    const userId = req.user.id;
    return this.casesService.updateCase(userId, id, body);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit files and lock a draft case' })
  @ApiParam({ name: 'id', description: 'UUID of the case to submit' })
  @ApiBody({ type: SubmitCaseDto })
  @ApiResponse({ status: 200, description: 'Case submitted successfully' })
  @ApiResponse({ status: 400, description: 'Validation or state transition failure' })
  async submitCase(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SubmitCaseDto,
  ) {
    const userId = req.user.id;
    return this.casesService.submitCase(userId, id, body);
  }
}
