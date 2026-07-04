import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesService } from './files.service';
import { GetPresignedUrlDto } from './dto/files.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('files/upload')
  @ApiOperation({ summary: 'Generate S3 pre-signed upload URL for scan files' })
  @ApiBody({ type: GetPresignedUrlDto })
  @ApiResponse({ status: 201, description: 'Pre-signed S3 URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or case locked' })
  async generateUploadUrl(
    @Req() req: any,
    @Body() body: GetPresignedUrlDto,
  ) {
    const userId = req.user.id;
    return this.filesService.generateUploadUrl(userId, body);
  }

  @Get('cases/:id/files')
  @ApiOperation({ summary: 'Get list of uploaded scan files for a specific case' })
  @ApiParam({ name: 'id', description: 'UUID of the case' })
  @ApiResponse({ status: 200, description: 'List of scan files returned successfully' })
  async getCaseFiles(@Req() req: any, @Param('id') caseId: string) {
    const userId = req.user.id;
    return this.filesService.getCaseFiles(userId, caseId);
  }
}
