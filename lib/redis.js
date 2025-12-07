const IORedis = require("ioredis");

let redis = null;

function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
  const password = process.env.UPSTASH_REDIS_PASSWORD || process.env.REDIS_PASSWORD;

  if (url) {
    redis = new IORedis(url, {
      password: password || undefined,
      maxRetriesPerRequest: null,
      tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    });
  } else {
    // Fall back to localhost
    redis = new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      password: password || undefined,
      maxRetriesPerRequest: null,
    });
  }

  return redis;
}

module.exports = { getRedis };
