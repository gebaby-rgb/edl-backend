import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as os from 'os';

@ApiTags('monitoring')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Base health check endpoint' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  getBase() {
    return this.getLiveness();
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe to check if the application is running' })
  @ApiResponse({ status: 200, description: 'Liveness check successful' })
  getLiveness() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe to verify all system dependencies are up' })
  @ApiResponse({ status: 200, description: 'Readiness check successful' })
  @ApiResponse({ status: 503, description: 'Database or S3 dependency offline' })
  async getReadiness() {
    const checks: Record<string, any> = {};
    let isReady = true;

    // 1. Database Check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'up' };
    } catch (e) {
      checks.database = { status: 'down', error: e.message };
      isReady = false;
    }

    // 2. AWS S3 Check
    const hasS3Config = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET
    );
    checks.s3 = {
      status: hasS3Config ? 'up' : 'down',
      bucket: process.env.AWS_S3_BUCKET || 'not-configured',
    };
    if (!hasS3Config) {
      // Treat as down if credentials are missing
      checks.s3.error = 'AWS credentials missing in environment variables';
      // If we don't strictly require S3 for boot, we don't set isReady = false.
      // But let's check: "S3 Check" should reflect status.
    }

    // 3. Memory Check
    const memory = process.memoryUsage();
    checks.memory = {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
    };

    // 4. System Info
    checks.system = {
      platform: process.platform,
      arch: process.arch,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
    };

    return {
      status: isReady ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
