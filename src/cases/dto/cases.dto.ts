import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsArray, IsNumber, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CaseFileDto {
  @ApiProperty({ description: 'Original name of the uploaded scan file', example: 'lower_jaw.stl' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'MIME type of the file', example: 'application/octet-stream' })
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiProperty({ description: 'S3 public or pre-signed download URL', example: 'https://s3.amazonaws.com/edl/lower_jaw.stl' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ description: 'File size in bytes', example: 1548290 })
  @IsNumber()
  fileSize: number;
}

export class CreateCaseDto {
  @ApiProperty({ description: 'UUID of the clinic requesting the case', example: 'd3b07384-d113-441d-a5d2-fc48b0a34b22' })
  @IsUUID()
  @IsNotEmpty()
  clinicId: string;

  @ApiProperty({ description: 'Patient name or reference code', example: 'Mariam Mahmoud' })
  @IsString()
  @IsNotEmpty()
  patientReference: string;

  @ApiProperty({ description: 'FDI tooth numbers selected for the case', example: [36, 37] })
  @IsArray()
  @IsNumber({}, { each: true })
  toothSelection: number[];

  @ApiProperty({ description: 'UUID of the shade from shade lookup', example: 'b29a28cd-70db-4322-92e1-45a8289456cf' })
  @IsUUID()
  @IsNotEmpty()
  shadeId: string;

  @ApiProperty({ description: 'UUID of the material from material lookup', example: 'a58682a8-12cd-411a-bd88-82ef58602b9e' })
  @IsUUID()
  @IsNotEmpty()
  materialId: string;

  @ApiProperty({ description: 'UUID of the priority (Low, Medium, High, Urgent)', example: '9a9cbefd-91df-4e3f-8461-9c3f848248bc' })
  @IsUUID()
  @IsNotEmpty()
  priorityId: string;

  @ApiProperty({ description: 'Expected delivery ISO date string', example: '2026-07-10T12:00:00.000Z' })
  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @ApiProperty({ description: 'Starting status of case', enum: ['Draft', 'Submitted'], example: 'Submitted' })
  @IsEnum(['Draft', 'Submitted'])
  status: 'Draft' | 'Submitted';

  @ApiPropertyOptional({ description: 'Optional list of initial scan files', type: [CaseFileDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseFileDto)
  files?: CaseFileDto[];
}

export class UpdateCaseDto {
  @ApiPropertyOptional({ description: 'UUID of the clinic requesting the case' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ description: 'Patient name or reference code' })
  @IsOptional()
  @IsString()
  patientReference?: string;

  @ApiPropertyOptional({ description: 'FDI tooth numbers selected for the case', example: [36, 37] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  toothSelection?: number[];

  @ApiPropertyOptional({ description: 'UUID of the shade from shade lookup' })
  @IsOptional()
  @IsUUID()
  shadeId?: string;

  @ApiPropertyOptional({ description: 'UUID of the material from material lookup' })
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional({ description: 'UUID of the priority' })
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional({ description: 'Expected delivery ISO date string' })
  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class SubmitCaseDto {
  @ApiProperty({ description: 'List of scan files to attach upon submission', type: [CaseFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseFileDto)
  files: CaseFileDto[];
}
