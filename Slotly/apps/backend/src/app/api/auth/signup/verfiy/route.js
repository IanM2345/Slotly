import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const PRESET_OTP = process.env.PRESET_OTP || '910456';

// CORS headers
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  try {
    console.log('=== SIGNUP VERIFY START ===');
    
    // Parse and log the request body
    const body = await request.json();
    console.log('Request body:', {
      ...body,
      password: body.password ? '[HIDDEN]' : 'undefined',
      otp: body.otp ? '[HIDDEN]' : 'undefined'
    });

    const {
      email,
      phone,
      name,
      password,    // Expected to be hashed from initiate step
      otp,         // Hashed OTP from initiate step
      otpEntered,  // User input (plain text)
      otpExpires,
      referralCode,
    } = body;

    // Enhanced validation with detailed error messages
    const missingFields = [];
    if (!otpEntered) missingFields.push('otpEntered');
    if (!name) missingFields.push('name');
    if (!password) missingFields.push('password');
    if (!email && !phone) missingFields.push('email or phone');

    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          missingFields,
          received: {
            email: !!email,
            phone: !!phone,
            name: !!name,
            password: !!password,
            otpEntered: !!otpEntered,
            otp: !!otp,
            otpExpires: !!otpExpires
          }
        },
        { status: 400, headers: CORS }
      );
    }

    console.log('All required fields present, proceeding with OTP verification...');

    // OTP verification with preset bypass
    let isValidOtp = false;
    
    if (otpEntered === PRESET_OTP) {
      console.log('Using preset OTP bypass');
      isValidOtp = true;
    } else {
      if (!otp) {
        console.log('No OTP hash provided for comparison');
        return NextResponse.json(
          { error: 'OTP verification data missing' },
          { status: 400, headers: CORS }
        );
      }
      
      if (!otpExpires) {
        console.log('No OTP expiry provided');
        return NextResponse.json(
          { error: 'OTP expiry data missing' },
          { status: 400, headers: CORS }
        );
      }
      
      // Check OTP expiry
      const now = Date.now();
      const expiryTime = new Date(otpExpires).getTime();
      console.log('OTP expiry check:', { now, expiryTime, expired: now > expiryTime });
      
      if (now > expiryTime) {
        return NextResponse.json(
          { error: 'OTP expired' },
          { status: 400, headers: CORS }
        );
      }
      
      // Verify OTP
      console.log('Comparing OTP with bcrypt...');
      isValidOtp = await bcrypt.compare(otpEntered, otp);
      console.log('OTP comparison result:', isValidOtp);
    }

    if (!isValidOtp) {
      console.log('Invalid OTP provided');
      return NextResponse.json(
        { error: 'Invalid OTP' },
        { status: 400, headers: CORS }
      );
    }

    console.log('OTP verified successfully, checking for existing user...');

    // Check if user already exists
    const whereCondition = [];
    if (email) whereCondition.push({ email });
    if (phone) whereCondition.push({ phone });

    const existingUser = await prisma.user.findFirst({
      where: { OR: whereCondition },
    });

    if (existingUser) {
      console.log('User already exists:', { id: existingUser.id, email: existingUser.email });
      return NextResponse.json(
        { error: 'User already exists with this email or phone' },
        { status: 409, headers: CORS }
      );
    }

    console.log('Creating new user...');

    // Create user (password should already be hashed from initiate step)
    const newUser = await prisma.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        name,
        password, // Already hashed from initiate
        role: 'CUSTOMER',
        otpVerified: true,
      },
    });

    console.log('User created successfully:', { id: newUser.id, name: newUser.name });

    // Handle referral code if provided
    if (referralCode) {
      console.log('Processing referral code:', referralCode);
      try {
        const referrer = await prisma.user.findFirst({ 
          where: { referralCode } 
        });
        
        if (referrer) {
          await prisma.referral.create({
            data: { 
              referrerId: referrer.id, 
              referredUserId: newUser.id 
            },
          });
          
          await prisma.notification.create({
            data: {
              userId: referrer.id,
              type: 'REFERRAL',
              title: '🎉 Someone Used Your Referral Code!',
              message: `${newUser.name} signed up with your code. After 2 bookings, they'll earn you a reward.`,
            },
          });
          
          console.log('Referral processed successfully');
        } else {
          console.log('Invalid referral code provided:', referralCode);
        }
      } catch (referralError) {
        console.error('Referral processing error:', referralError);
        // Continue with signup even if referral fails
      }
    }

    // Generate JWT token
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: CORS }
      );
    }

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('JWT token generated, signup complete');
    console.log('=== SIGNUP VERIFY SUCCESS ===');

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
        },
      },
      { headers: CORS }
    );

  } catch (error) {
    console.error('=== SIGNUP VERIFY ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    
    return NextResponse.json(
      { 
        error: 'Signup verification failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500, headers: CORS }
    );
  } finally {
    await prisma.$disconnect();
  }
}