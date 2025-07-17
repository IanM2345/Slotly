import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';
import { sendOTPviaSMS } from '@/shared/notifications/twilioClient'; 
import { sendOTPviaEmail } from '@/shared/notifications/mailgunClient';

const prisma = new PrismaClient();

function generateOTP(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
}

export async function POST(request) {
  try {
    const { email, phone, password, name, referralCode } = await request.json();

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email ?? '' },
          { phone: phone ?? '' }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email or phone already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 8);
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    const newUser = await prisma.user.create({
      data: {
        email: email ?? null,
        phone: phone ?? null,
        password: hashedPassword,
        name,
        role: 'CUSTOMER',
        otp: hashedOTP,
        otpExpiresAt: otpExpires,
        otpVerified: false,
      }
    });

    if (phone) await sendOTPviaSMS(phone, otp);
    if (email) await sendOTPviaEmail(email, otp);

  
    if (referralCode) {
      const referrer = await prisma.user.findFirst({
        where: { referralCode }
      });

      if (referrer) {
        await prisma.referral.create({
          data: {
            referrerId: referrer.id,
            referredUserId: newUser.id,
          }
        });

        await prisma.notification.create({
          data: {
            userId: referrer.id,
            type: 'REFERRAL',
            title: '🎉 Someone Used Your Referral Code!',
            message: `${newUser.name} just signed up using your referral code. Once they complete 2 bookings, you’ll be 1 step closer to a coupon.`,
          }
        });
      }
    }

    return NextResponse.json({
      message: 'OTP sent. Please verify to complete signup.',
      userId: newUser.id  
    }, { status: 201 });
  } catch (error) {
    console.error('Error during signup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
