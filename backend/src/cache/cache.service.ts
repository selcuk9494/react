import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private isMock = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
        });

        this.redis.on('error', (err) => {
          console.warn('Redis connection error:', err.message);
          this.fallbackToMemory();
        });

        await this.redis.ping();
        console.log('✅ Connected to Redis successfully');
      } catch {
        console.warn('⚠️  Redis unavailable, using in-memory cache');
        this.fallbackToMemory();
      }
    } else {
      console.log('ℹ️  No REDIS_URL provided, using in-memory cache');
      this.fallbackToMemory();
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private fallbackToMemory() {
    this.isMock = true;
    this.redis = null;
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanupMemoryCache(), 5 * 60 * 1000);
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, data] of this.memoryCache.entries()) {
      if (data.expiry < now) {
        this.memoryCache.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isMock) {
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          return cached.value as T;
        }
        this.memoryCache.delete(key);
        return null;
      }

      const value = await this.redis?.get(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.warn(`Cache GET error for key ${key}:`, (e as any)?.message);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      if (this.isMock) {
        this.memoryCache.set(key, {
          value,
          expiry: Date.now() + ttlSeconds * 1000,
        });
        return;
      }

      await this.redis?.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (e) {
      console.warn(`Cache SET error for key ${key}:`, (e as any)?.message);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.isMock) {
        this.memoryCache.delete(key);
        return;
      }

      await this.redis?.del(key);
    } catch (e) {
      console.warn(`Cache DEL error for key ${key}:`, e.message);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.isMock) {
        const keys = Array.from(this.memoryCache.keys());
        const regex = new RegExp(pattern.replace('*', '.*'));
        keys
          .filter((k) => regex.test(k))
          .forEach((k) => this.memoryCache.delete(k));
        return;
      }

      const keys = await this.redis?.keys(pattern);
      if (keys && keys.length > 0) {
        await this.redis?.del(...keys);
      }
    } catch (e) {
      console.warn(`Cache DEL pattern error for ${pattern}:`, e.message);
    }
  }

  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }
}
