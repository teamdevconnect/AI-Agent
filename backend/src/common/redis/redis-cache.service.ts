import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('redisUrl')!, {
      // Bounded retries — this is a producer-side cache client, not a
      // BullMQ Worker/QueueEvents connection (those require
      // maxRetriesPerRequest: null instead). A cache miss should fail fast,
      // not hang a request while Redis is unreachable.
      maxRetriesPerRequest: 2,
    });
    // ioredis emits 'error' on every failed connection attempt — an
    // unhandled 'error' event on a Node EventEmitter crashes the process,
    // so this listener is required even though get/set already catch.
    this.client.on('error', (err) => this.logger.warn(`Redis cache connection issue: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // fail open — a cache error must never break a read
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // non-fatal
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.client.del(keys);
    } catch {
      // non-fatal
    }
  }
}
