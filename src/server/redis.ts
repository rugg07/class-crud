import Redis from 'ioredis';
import { env } from './env';

// Initialize Redis client from environment URL.
export const redis = new Redis(env.REDIS_URL);
