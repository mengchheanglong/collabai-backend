// src/shared/services/redis.service.ts
//
// Thin ioredis wrapper exposed as a NestJS injectable. Provides get/set/del/scan
// (+ a few atomic helpers: incr/expire/exists) used by the auth infrastructure.
//
// Resilience: the client is configured to FAIL FAST when Redis is unreachable
// (enableOfflineQueue: false) rather than hang, and the connection 'error' event is
// handled so a missing Redis never crashes the process. Callers (TokenBlacklistService,
// AccountLockoutService) wrap calls in try/catch to "fail open".

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly keyPrefix: string;
  private errorLogged = false;

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.keyPrefix = this.config.get<string>('REDIS_PREFIX') ?? '';

    this.client = new Redis(url, {
      keyPrefix: this.keyPrefix,
      lazyConnect: true, // don't connect at construction; onModuleInit does it non-fatally
      enableOfflineQueue: false, // reject commands immediately when down (fail-fast)
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
    });

    this.client.on('error', (err: Error) => {
      // Log once per outage to avoid spamming while Redis is down.
      if (!this.errorLogged) {
        this.logger.warn(
          `Redis error — Redis-backed features will fail open: ${err.message}`,
        );
        this.errorLogged = true;
      }
    });

    this.client.on('ready', () => {
      this.errorLogged = false;
      this.logger.log('Redis connection ready');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      this.logger.warn(
        `Redis unavailable at startup — continuing without it (fail-open): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      /* ignore shutdown errors */
    }
  }

  /** Escape hatch for advanced commands not wrapped here. */
  get raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  /**
   * Return all keys matching `${prefix}*` using a non-blocking SCAN loop.
   * NOTE: ioredis does not apply `keyPrefix` to SCAN's MATCH pattern, so we prepend it
   * here; returned keys therefore include the configured keyPrefix.
   */
  async scan(prefix: string): Promise<string[]> {
    const match = `${this.keyPrefix}${prefix}*`;
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(
        cursor,
        'MATCH',
        match,
        'COUNT',
        100,
      );
      cursor = next;
      found.push(...keys);
    } while (cursor !== '0');
    return found;
  }

  /** Delete every key matching `${prefix}*` (used for prefix-scan cache invalidation). */
  async deleteByPrefix(prefix: string): Promise<void> {
    const keys = await this.scan(prefix);
    if (keys.length > 0) {
      // scan() returns full keys (keyPrefix already included), so delete via the raw
      // client to avoid re-applying keyPrefix.
      await this.client.del(...keys);
    }
  }
}
