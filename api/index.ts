/* eslint-disable @typescript-eslint/no-var-requires */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import type { IncomingMessage, ServerResponse } from 'http';

// Use require to avoid ESM/CJS mismatch with express
const express = require('express');

const server = express();
let app: any;
let isBootstrapped = false;

async function bootstrap() {
  if (isBootstrapped) return;
  app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: '*' });
  await app.init();
  isBootstrapped = true;
}

module.exports = async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await bootstrap();
    server(req, res);
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server initialization failed', details: String(err) }));
  }
};
