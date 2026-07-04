import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/users.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and role specifications' })
  @ApiResponse({ status: 200, description: 'Profile returned successfully' })
  async getProfile(@Req() req: any) {
    const userId = req.user.id;
    return this.usersService.getProfile(userId);
  }

  @Put('update')
  @ApiOperation({ summary: 'Update current user profile and role details' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async updateProfile(
    @Req() req: any,
    @Body() body: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    return this.usersService.updateProfile(userId, body);
  }
}
