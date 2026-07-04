import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/quotations.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('quotations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post('cases/:id/quotation')
  @ApiOperation({ summary: 'Create a price quote for a submitted case' })
  @ApiParam({ name: 'id', description: 'UUID of the case' })
  @ApiBody({ type: CreateQuotationDto })
  @ApiResponse({ status: 201, description: 'Quotation created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or case not submitted' })
  async createQuotation(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: CreateQuotationDto,
  ) {
    const userId = req.user.id;
    return this.quotationsService.createQuotation(userId, caseId, body);
  }

  @Post('quotations/:id/accept')
  @ApiOperation({ summary: 'Accept a quotation and lock the case in production queue' })
  @ApiParam({ name: 'id', description: 'UUID of the quotation to accept' })
  @ApiResponse({ status: 200, description: 'Quotation accepted, invoice generated' })
  @ApiResponse({ status: 400, description: 'Invalid quotation state' })
  async acceptQuotation(@Req() req: any, @Param('id') quoteId: string) {
    const userId = req.user.id;
    return this.quotationsService.acceptQuotation(userId, quoteId);
  }

  @Post('quotations/:id/reject')
  @ApiOperation({ summary: 'Reject a quotation and return case to Under Review' })
  @ApiParam({ name: 'id', description: 'UUID of the quotation to reject' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 400, description: 'Invalid quotation state' })
  async rejectQuotation(@Req() req: any, @Param('id') quoteId: string) {
    const userId = req.user.id;
    return this.quotationsService.rejectQuotation(userId, quoteId);
  }
}
