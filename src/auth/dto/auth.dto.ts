import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    description: 'Egyptian mobile number starting with +20 or 01',
    example: '+201035748525',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Egyptian mobile number starting with +20 or 01',
    example: '+201035748525',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: '4-digit or 6-digit OTP code received via SMS',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Secure session refresh token',
    example: 'refresh_token_example_uuid',
  })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
