import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import * as express from 'express';
import { IncomingMessage, ServerResponse } from 'http';

const expressApp = express();
let isInitialized = false;

async function bootstrap() {
  if (!isInitialized) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { logger: ['error', 'warn'] },
    );
    app.setGlobalPrefix('api/v1');
    app.enableCors();
    await app.init();
    isInitialized = true;
  }
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await bootstrap();
  expressApp(req, res);
}
