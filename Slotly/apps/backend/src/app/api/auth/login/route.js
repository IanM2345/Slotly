import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';
import { sendNotification } from '@/shared/notifications/sendNotification';
import { sendEmailNotification } from '@/shared/notifications/sendEmailNotifciation';
import { signAccessToken, signRefreshToken, newJti } from '../../../../lib/token';

const prisma = new PrismaClient();

// Shared CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(req) {
  try {
    return NextResponse.json({}, { 
      status: 200, 
      headers: CORS_HEADERS 
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        endpoint: '/api/auth/login',
        method: 'OPTIONS',
        error_type: 'cors_preflight_error'
      }
    });
    
    return NextResponse.json(
      { error: "CORS preflight failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * POST /api/auth/login - User authentication endpoint
 * 
 * Authenticates users via email/phone and password, returns JWT tokens
 * 
 * @param {Request} request - The incoming request object
 * @returns {Response} Authentication tokens and user data or error response
 */
export async function POST(request) {
  try {
    // Parse and normalize input
    const body = await request.json();
    const rawEmail = typeof body.email === 'string' ? body.email : undefined;
    const rawPhone = typeof body.phone === 'string' ? body.phone : undefined;
    const email = rawEmail?.trim().toLowerCase();   // normalize email
    const phone = rawPhone?.trim();                 // normalize phone (consider E.164 later)
    const password = body.password;
    const name = body.name;

    // Validate input
    if (!email && !phone) {
      return NextResponse.json(
        { 
          error: 'Email or phone is required',
          details: 'Please provide either an email address or phone number to log in.'
        }, 
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!password) {
      return NextResponse.json(
        { 
          error: 'Password is required',
          details: 'Please provide a password to log in.'
        }, 
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Build search conditions
    const searchConditions = [];
    if (email) searchConditions.push({ email });
    if (phone) searchConditions.push({ phone });

    // Find existing user
    let user = await prisma.user.findFirst({
      where: { 
        OR: searchConditions
      },
      select: { 
        id: true, 
        email: true, 
        phone: true, 
        role: true, 
        name: true, 
        password: true, 
        createdAt: true
      }
    });

    // User not found → authentication failed
    if (!user) {
      console.warn('Login attempt with invalid credentials');
      
      // Track failed login attempts
      Sentry.addBreadcrumb({
        message: 'Failed login attempt - user not found',
        category: 'auth',
        level: 'warning',
        data: {
          email_provided: !!email,
          phone_provided: !!phone,
          endpoint: '/api/auth/login'
        }
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid credentials',
          details: 'The provided email/phone and password combination is not valid.'
        }, 
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Password validation
    if (!user.password) {
      console.warn('Login attempt for user without password');
      
      return NextResponse.json(
        { 
          error: 'Invalid credentials',
          details: 'The provided email/phone and password combination is not valid.'
        }, 
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('Login attempt with incorrect password');
      
      // Track password mismatch
      Sentry.addBreadcrumb({
        message: 'Failed login attempt - incorrect password',
        category: 'auth',
        level: 'warning',
        data: {
          user_id: user.id,
          endpoint: '/api/auth/login'
        }
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid credentials',
          details: 'The provided email/phone and password combination is not valid.'
        }, 
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Check for suspended business (optional - if you want to block users with suspended businesses)
    let userHasSuspendedBusiness = false;
    try {
      const suspendedBiz = await prisma.business.findFirst({
        where: { ownerId: user.id, suspended: true },
        select: { id: true }
      });
      userHasSuspendedBusiness = !!suspendedBiz;
      
      // If you want to block login for users with suspended businesses
      if (userHasSuspendedBusiness) {
        console.warn(`User with suspended business login attempt: ${user.id}`);
        
        // Send suspension notifications
        try {
          await sendNotification({
            userId: user.id,
            type: 'SUSPENSION',
            title: 'Business Suspended',
            message: 'Your Slotly business has been suspended. Please contact support for assistance.',
          });

          if (user.email) {
            await sendEmailNotification({
              to: user.email,
              subject: 'Your Slotly Business Has Been Suspended',
              text: 'Your Slotly business has been suspended. Please contact support for assistance.',
            });
          }
        } catch (notificationError) {
          console.error('Failed to send suspension notifications:', notificationError);
          
          Sentry.captureException(notificationError, {
            tags: {
              endpoint: '/api/auth/login',
              error_type: 'suspension_notification_failed',
              user_id: user.id
            }
          });
        }

        // Track suspended business login attempts
        Sentry.addBreadcrumb({
          message: 'User with suspended business login attempt',
          category: 'auth',
          level: 'warning',
          data: {
            user_id: user.id,
            user_email: user.email
          }
        });

        return NextResponse.json(
          { 
            error: 'Business suspended',
            details: 'Your business has been suspended. Please contact support for assistance.'
          },
          { status: 403, headers: CORS_HEADERS }
        );
      }
    } catch (bizError) {
      // If Business model doesn't exist or query fails, just continue
      console.warn('Could not check business suspension status:', bizError);
    }

    // Set user context for Sentry
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
      role: user.role
    });

    // Issue tokens
    const accessToken = signAccessToken(user);

    // Create refresh token record (30d default)
    const jti = newJti();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    try {
      await prisma.refreshToken.create({
        data: {
          jti,
          userId: user.id,
          expiresAt,
          userAgent: request.headers.get("user-agent") || undefined,
          ip: request.headers.get("x-forwarded-for") || 
              request.headers.get("x-real-ip") || 
              undefined,
        },
      });
    } catch (refreshTokenError) {
      console.error('Failed to create refresh token:', refreshTokenError);
      
      Sentry.captureException(refreshTokenError, {
        tags: {
          endpoint: '/api/auth/login',
          error_type: 'refresh_token_creation_failed',
          user_id: user.id
        }
      });
      
      // Continue with login even if refresh token creation fails
      // The access token will still work for immediate authentication
    }
    
    const refreshToken = signRefreshToken(user, jti);

    // Track successful login
    Sentry.addBreadcrumb({
      message: 'Successful user login',
      category: 'auth',
      level: 'info',
      data: {
        user_id: user.id,
        user_role: user.role,
        endpoint: '/api/auth/login'
      }
    });

    console.log(`✅ Successful login for user: ${user.id}`);

    return NextResponse.json(
      {
        message: 'Login successful',
        token: accessToken,
        refreshToken,
        user: { 
          id: user.id, 
          email: user.email, 
          phone: user.phone,
          name: user.name, 
          role: user.role
        },
        sessionInfo: {
          loginTime: new Date().toISOString(),
          tokenExpiresIn: '1h', // Adjust based on your token configuration
          refreshTokenExpiresIn: '30d',
          hasSuspendedBusiness: userHasSuspendedBusiness
        }
      },
      { status: 200, headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('Login error:', error);
    
    Sentry.captureException(error, { 
      tags: { 
        endpoint: '/api/auth/login',
        error_type: 'internal_server_error'
      },
      contexts: {
        request: {
          url: request.url,
          method: request.method,
          headers: {
            'user-agent': request.headers.get('user-agent'),
            'content-type': request.headers.get('content-type')
          }
        }
      }
    });
    
    return NextResponse.json(
      { 
        error: 'Login failed',
        details: 'An internal server error occurred. Please try again later.'
      }, 
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    // Ensure Prisma connection is properly closed
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      Sentry.captureException(disconnectError, {
        tags: {
          endpoint: '/api/auth/login',
          error_type: 'prisma_disconnect_failed'
        }
      });
    }
  }
}