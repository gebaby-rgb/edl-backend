import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private ipRequests = new Map<string, number[]>();
  private readonly LIMIT = 100;
  private readonly WINDOW_MS = 60 * 1000; // 1 minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';

    const now = Date.now();
    let timestamps = this.ipRequests.get(ip) || [];

    // Filter out timestamps outside the sliding window
    timestamps = timestamps.filter((time) => now - time < this.WINDOW_MS);

    if (timestamps.length >= this.LIMIT) {
      throw new HttpException(
        'Too many requests from this IP, please try again in a minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.ipRequests.set(ip, timestamps);

    return true;
  }
}
