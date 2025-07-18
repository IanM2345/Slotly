import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';
import { sendOTPviaSMS } from '@/lib/twilioClient'; 
import { sendOTPviaEmail } from '@/lib/mailgunClient'; 
import { sendNotification } from '@/shared/notifications/sendNotification';
import { sendEmailNotification } from '@/shared/notifications/sendEmailNotifciation';

const prisma = new PrismaClient();

function generateOTP(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
}

export async function POST(request) {
  try {
    const { email, phone, password } = await request.json();

    if ((!email && !phone) || !password) {
      return NextResponse.json(
        { error: 'Email or phone and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email ?? '' },
          { phone: phone ?? '' }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.suspended) {
      await sendNotification({
        userId: user.id,
        type: 'SUSPENSION',
        title: 'Account Suspended',
        message: 'Your Slotly account has been suspended. Please contact support for assistance.'
      });

      if (user.email) {
        await sendEmailNotification({
          to: user.email,
          subject: 'Your Slotly Account Has Been Suspended',
          text: 'Your Slotly account has been suspended. Please contact support for assistance.'
        });
      }

      if (user.phone) {
        await sendOTPviaSMS(
          user.phone,
          'Your Slotly account has been suspended. Please contact support for assistance.'
        );
      }

      return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 });
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 8);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); 

    await prisma.user.update({
      where: { id: user.id },
      data: { otp: hashedOTP, otpExpiresAt: otpExpires, otpVerified: false }
    });

    if (user.phone) {
      await sendOTPviaSMS(user.phone, otp);
    }
    if (user.email) {
      await sendOTPviaEmail(user.email, otp);
    }

    return NextResponse.json({
      message: 'OTP sent to your registered contact. Please verify to complete login.',
      user: { id: user.id, name: user.name, role: user.role }
    }, { status: 200 });

  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'LOGIN' } });
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
