import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: { field: string; message: string }[] = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resBody = exception.getResponse() as any;

      if (typeof resBody === 'object' && resBody !== null) {
        message = resBody.message || exception.message;
        if (Array.isArray(resBody.message)) {
          message = 'Validation failed';
          errors = resBody.message.map((err: string) => {
            const firstSpace = err.indexOf(' ');
            const field = firstSpace !== -1 ? err.substring(0, firstSpace) : 'unknown';
            return {
              field,
              message: err,
            };
          });
        } else if (typeof resBody.message === 'string') {
          errors = [{ field: 'body', message: resBody.message }];
        }
      } else {
        message = exception.message;
      }
    } else {
      message = exception.message || 'Internal server error';
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}
