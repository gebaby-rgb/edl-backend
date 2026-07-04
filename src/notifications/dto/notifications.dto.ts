import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM push notification token', example: 'fcm_token_example_value' })
  @IsString()
  @IsNotEmpty()
  pushToken: string;

  @ApiProperty({ description: 'Device platform OS (e.g., ios, android, web)', example: 'android' })
  @IsString()
  @IsNotEmpty()
  platform: string;
}
