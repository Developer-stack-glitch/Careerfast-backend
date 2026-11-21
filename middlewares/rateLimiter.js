// Lightweight in-memory rate limiter middleware for authentication and OTP endpoints
const rateLimitBuckets = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitBuckets.entries()) {
    if (now > data.resetTime) {
      rateLimitBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

const createRateLimiter = ({ windowMs, maxRequests, message }) => {
  return (req, res, next) => {
    // Determine client identifier (IP + optional key)
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown-ip";

    const bucketKey = `${req.baseUrl}${req.path}:${clientIp}`;
    const now = Date.now();

    let bucket = rateLimitBuckets.get(bucketKey);

    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitBuckets.set(bucketKey, bucket);
      return next();
    }

    bucket.count += 1;

    if (bucket.count > maxRequests) {
      const retryAfterSec = Math.ceil((bucket.resetTime - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please slow down and try again later.",
        retryAfter: retryAfterSec,
      });
    }

    next();
  };
};

// 10 login attempts per minute per IP
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: "Too many login attempts. Please wait a minute before trying again.",
});

// 5 OTP requests per 3 minutes
const otpLimiter = createRateLimiter({
  windowMs: 3 * 60 * 1000,
  maxRequests: 6,
  message: "Too many OTP requests. Please wait a few minutes before trying again.",
});

module.exports = {
  createRateLimiter,
  authLimiter,
  otpLimiter,
};
