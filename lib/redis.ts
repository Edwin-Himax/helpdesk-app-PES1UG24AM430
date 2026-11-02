import { createClient, RedisClientType } from 'redis';

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: RedisClientType | undefined;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Keys according to specification
export const CACHE_KEY_LATEST = 'help:latest';
export const COUNTER_KEY_VIEWS = 'help:views';
export const CACHE_TTL_SECONDS = 60; // 60 seconds TTL

let isConnecting = false;
let redisAvailable = false;
let fallbackViewCount = 0;
let fallbackCache: string | null = null;
let fallbackCacheExpiry = 0;

/**
 * Initializes and retrieves the singleton Redis client.
 * Includes graceful connection handling so if Redis is unavailable,
 * the app continues to operate using PostgreSQL without crashing.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (global.__redisClient && global.__redisClient.isOpen) {
    return global.__redisClient;
  }

  if (isConnecting) {
    // Wait briefly if connection is in-flight
    await new Promise((r) => setTimeout(r, 200));
    if (global.__redisClient && global.__redisClient.isOpen) {
      return global.__redisClient;
    }
  }

  try {
    isConnecting = true;
    const client: RedisClientType = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            return false; // Stop auto-reconnecting after 3 tries to prevent console spam
          }
          return Math.min(retries * 500, 2000);
        },
      },
    });

    client.on('error', (err) => {
      redisAvailable = false;
      // Do not crash the app, log informative message
      // console.warn('[Redis] Connection error:', err.message);
    });

    client.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected successfully to', REDIS_URL);
    });

    await client.connect();
    global.__redisClient = client;
    redisAvailable = true;
    return client;
  } catch (error) {
    redisAvailable = false;
    // console.warn('[Redis] Unable to connect to Redis server. Operating in resilient fallback mode.');
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Fetches the cached requests from Redis (key: help:latest).
 * Returns null if cache miss or Redis is unavailable.
 */
export async function getCachedLatestRequests<T = unknown>(): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (client && client.isOpen) {
      const data = await client.get(CACHE_KEY_LATEST);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    }
  } catch (err) {
    console.warn('[Redis] Error reading cache:', (err as Error).message);
  }

  // Check fallback in-memory cache if Redis is down
  if (fallbackCache && Date.now() < fallbackCacheExpiry) {
    try {
      return JSON.parse(fallbackCache) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Caches the requests in Redis with a 60-second TTL (key: help:latest).
 */
export async function setCachedLatestRequests(data: unknown): Promise<void> {
  const serialized = JSON.stringify(data);
  try {
    const client = await getRedisClient();
    if (client && client.isOpen) {
      await client.set(CACHE_KEY_LATEST, serialized, {
        EX: CACHE_TTL_SECONDS,
      });
      return;
    }
  } catch (err) {
    console.warn('[Redis] Error writing to cache:', (err as Error).message);
  }

  // Resilient memory cache with 60s TTL if Redis is unavailable
  fallbackCache = serialized;
  fallbackCacheExpiry = Date.now() + CACHE_TTL_SECONDS * 1000;
}

/**
 * Invalidates the latest requests cache in Redis (del help:latest).
 */
export async function invalidateLatestRequestsCache(): Promise<void> {
  try {
    const client = await getRedisClient();
    if (client && client.isOpen) {
      await client.del(CACHE_KEY_LATEST);
    }
  } catch (err) {
    console.warn('[Redis] Error deleting cache key:', (err as Error).message);
  }

  // Invalidate fallback memory cache
  fallbackCache = null;
  fallbackCacheExpiry = 0;
}

/**
 * Increments the page view counter using atomic Redis INCR.
 * Key: help:views
 * "Use Redis INCR, not a read-then-write sequence."
 */
export async function incrementBoardViews(): Promise<number> {
  try {
    const client = await getRedisClient();
    if (client && client.isOpen) {
      const newCount = await client.incr(COUNTER_KEY_VIEWS);
      return newCount;
    }
  } catch (err) {
    console.warn('[Redis] Error incrementing views:', (err as Error).message);
  }

  // Resilient fallback increment
  fallbackViewCount += 1;
  return fallbackViewCount;
}

/**
 * Gets the current view count without incrementing.
 */
export async function getBoardViews(): Promise<number> {
  try {
    const client = await getRedisClient();
    if (client && client.isOpen) {
      const count = await client.get(COUNTER_KEY_VIEWS);
      return count ? parseInt(count, 10) : 0;
    }
  } catch (err) {
    console.warn('[Redis] Error fetching views:', (err as Error).message);
  }

  return fallbackViewCount;
}

export function isRedisConnected(): boolean {
  return redisAvailable && Boolean(global.__redisClient?.isOpen);
}
