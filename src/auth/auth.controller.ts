import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS verification OTP code' })
  @ApiBody({ type: RequestOtpDto })
  @ApiResponse({ status: 200, description: 'OTP code generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body.phone);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code and authenticate session' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'JWT tokens generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or code' })
  async verifyOtp(@Body() body: LoginDto) {
    return this.authService.verifyOtp(body.phone, body.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh session tokens using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Session refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshSession(@Body() body: RefreshTokenDto) {
    return this.authService.refreshSession(body.refresh_token);
  }
}
