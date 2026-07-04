import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  simple(),
);

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: winston.Logger;
  private context: string = 'Application';

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      format: isProduction ? prodFormat : devFormat,
      defaultMeta: { service: 'edl-backend' },
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context: context || this.context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }
}
