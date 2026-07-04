import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ScheduleDeliveryDto {
  @ApiProperty({ description: 'ID of the courier user assigned to ship the package', example: 'courier_1' })
  @IsString()
  @IsNotEmpty()
  courierId: string;

  @ApiPropertyOptional({ description: 'Optional shipping instructions or address directions', example: 'Deliver before 5 PM' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmDeliveryDto {
  @ApiPropertyOptional({ description: 'Optional signature image URL uploaded by doctor/receiver', example: 'https://storage.edl.com/signatures/doctor_sig.png' })
  @IsString()
  @IsOptional()
  signatureUrl?: string;
}
