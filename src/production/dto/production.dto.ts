import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class AssignTechnicianDto {
  @ApiProperty({ description: 'UUID of the production stage', example: '7b29a2cd-70db-4322-92e1-45a8289456cf' })
  @IsUUID()
  @IsNotEmpty()
  stageId: string;

  @ApiProperty({ description: 'UUID of the technician (User ID)', example: 'a58682a8-12cd-411a-bd88-82ef58602b9e' })
  @IsUUID()
  @IsNotEmpty()
  technicianId: string;
}

export class UpdateStageDto {
  @ApiProperty({ description: 'UUID of the production stage to update', example: '7b29a2cd-70db-4322-92e1-45a8289456cf' })
  @IsUUID()
  @IsNotEmpty()
  stageId: string;

  @ApiProperty({ description: 'New stage status (e.g., Pending, In_Progress, Completed)', example: 'In_Progress' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({ description: 'Optional Quality Control score (1-100)', example: 95 })
  @IsNumber()
  @IsOptional()
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'Optional Quality Control notes/comments', example: 'Excellent margin fit and surface finish' })
  @IsString()
  @IsOptional()
  qualityNotes?: string;
}
