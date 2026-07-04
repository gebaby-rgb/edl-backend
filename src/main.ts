import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { RateLimitGuard } from './auth/guards/rate-limit.guard';
import { AuditLogInterceptor } from './auth/interceptors/audit-log.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { AppLogger } from './logger/logger.service';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use structured Winston logger as the NestJS application logger
  const logger = app.get(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  // Security: Helmet adds secure HTTP response headers
  app.use((helmet as any).default());

  // Performance: Gzip compress all responses
  app.use((compression as any)());

  // CORS: restrict to explicit origin list in production
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:4000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser clients (mobile apps, curl) which send no origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      callback(new Error(`CORS origin rejected: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Set global API prefix matching REST specification
  app.setGlobalPrefix('api/v1');

  // Register Global Exception Filter
  app.useGlobalFilters(new ApiExceptionFilter());

  // Enable global validation pipe with strict production configurations
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Setup Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('EDL Dental Lab API')
    .setDescription('Production-grade REST API specifications for EDL Dental Laboratory Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Register global Rate Limiter
  app.useGlobalGuards(new RateLimitGuard());

  // Resolve Prisma & register global Audit Logger
  const prisma = app.get(PrismaService);
  app.useGlobalInterceptors(new AuditLogInterceptor(prisma));

  const port = process.env.PORT || 4000;
  const server = await app.listen(port);

  logger.log(`EDL Dental Lab API listening on port ${port} [${process.env.NODE_ENV || 'development'}]`);

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal} — shutting down gracefully…`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.log('Database connection closed. Bye.');
      process.exit(0);
    });

    // Force exit after 10 seconds if cleanup hangs
    setTimeout(() => {
      logger.error('Forced shutdown after 10s timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
