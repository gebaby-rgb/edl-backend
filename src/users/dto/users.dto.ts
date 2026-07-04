import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Full name of the user', example: 'Dr. Mohammad Assiut' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Email address of the user', example: 'doctor@edl.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Medical specialization (Doctor role only)', example: 'Orthodontics & Implants' })
  @IsString()
  @IsOptional()
  specialization?: string;

  @ApiPropertyOptional({ description: 'Brief bio or clinic info (Doctor role only)', example: 'Consultant orthodontist at Assiut Modern Clinic' })
  @IsString()
  @IsOptional()
  bio?: string;
}
