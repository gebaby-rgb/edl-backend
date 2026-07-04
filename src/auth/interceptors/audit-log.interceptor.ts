import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

// Sensitive GET endpoints that should also be audit-logged
const SENSITIVE_GET_PATTERNS = ['/reports/', '/files/', '/api/v1/reports', '/api/v1/files'];

function isSensitiveGet(method: string, url: string): boolean {
  if (method !== 'GET') return false;
  return SENSITIVE_GET_PATTERNS.some((pattern) => url.includes(pattern));
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, user } = request;

    const shouldLog =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ||
      isSensitiveGet(method, url);

    return next.handle().pipe(
      tap(async () => {
        if (shouldLog && user && user.id) {
          try {
            await this.prisma.auditLog.create({
              data: {
                userId: user.id,
                action: `${method} ${url}`,
                tableName: context.getClass().name,
                recordId: request.params?.id ?? '00000000-0000-0000-0000-000000000000',
                ipAddress: ip || request.headers['x-forwarded-for'] || 'unknown',
              },
            });
          } catch (error) {
            // Audit log failure must NOT break the response chain
            // Log the error but continue
            console.error('[AuditLog] Failed to persist audit entry:', (error as Error).message);
          }
        }
      }),
    );
  }
}
