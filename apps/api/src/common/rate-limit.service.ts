import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateBucket = { count: number; resetAt: number };

@Injectable()
export class InMemoryRateLimitService {
  private readonly buckets = new Map<string, RateBucket>();

  consume(key: string, limit: number, windowMs = 60_000): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (bucket.count >= limit) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
  }
}
