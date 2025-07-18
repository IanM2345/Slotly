import jwt from 'jsonwebtoken';
import * as Sentry from '@sentry/nextjs';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  const error = new Error('JWT_SECRET is not set in environment variables');
  Sentry.captureException(error);
  throw error;
}

/**
 * Verifies a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {{ valid: boolean, decoded?: object, error?: string }}
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (err) {
    const isExpected =
      err.name === 'TokenExpiredError' ||
      err.name === 'JsonWebTokenError' ||
      err.name === 'NotBeforeError';

    // Unexpected verification errors
    if (!isExpected) {
      Sentry.captureException(err, {
        tags: { module: 'auth', level: 'critical' },
        extra: { reason: err.message, tokenSnippet: token?.slice(0, 12) + '...' },
      });
    }

    console.error('JWT verification failed:', err);
    return { valid: false, error: 'Invalid or expired token' };
  }
}

/**
 * Authenticates a Next.js Request by checking its Authorization header
 * @param {Request} request - The incoming request object
 * @returns {Promise<{ valid: boolean, decoded?: object, error?: string }>}
 */
export async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const warning = 'Authorization header missing or malformed';
    Sentry.captureMessage(warning, {
      level: 'warning',
      tags: { module: 'auth' },
    });

    return { valid: false, error: warning };
  }

  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}
