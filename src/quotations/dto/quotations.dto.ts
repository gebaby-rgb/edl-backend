import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateQuotationDto {
  @ApiProperty({ description: 'Base cost before tax and discount', example: 1800.0 })
  @IsNumber()
  @IsNotEmpty()
  totalAmount: number;

  @ApiPropertyOptional({ description: 'Discount to apply', example: 200.0, default: 0.0 })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiPropertyOptional({ description: 'Tax amount to apply', example: 150.0, default: 0.0 })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiProperty({ description: 'Quotation validity expiry date', example: '2026-07-10T12:00:00.000Z' })
  @IsString()
  @IsNotEmpty()
  validUntil: string;

  @ApiPropertyOptional({ description: 'Additional terms, warranty, or notes', example: '10-year warranty included on material' })
  @IsString()
  @IsOptional()
  notes?: string;
}
