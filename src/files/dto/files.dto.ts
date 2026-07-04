import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class GetPresignedUrlDto {
  @ApiProperty({ description: 'UUID of the case to attach the file to', example: 'd3b07384-d113-441d-a5d2-fc48b0a34b22' })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty({ description: 'Original file name of the scan', example: 'upper_jaw.stl' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'File MIME type', example: 'application/octet-stream' })
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiProperty({ description: 'File size in bytes', example: 10485760 })
  @IsNumber()
  @IsNotEmpty()
  fileSize: number;
}
