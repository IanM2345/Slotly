
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sendOTPviaSMS } from '@/lib/twilioClient';
import { sendOTPviaEmail } from '@/lib/mailgunClient';

function generateOTP(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
}

export async function POST(request) {
  try {
    const { email, phone, password, name } = await request.json();

    if (!name || (!email && !phone) || !password) {
      return NextResponse.json({ error: 'Name, phone/email, and password are required' }, { status: 400 });
    }

    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedOTP = await bcrypt.hash(otp, 8);
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    if (phone) {
      const result = await sendOTPviaSMS(phone, otp);
      if (!result?.sid) {
        return NextResponse.json({ error: 'Failed to send OTP via SMS' }, { status: 500 });
      }
    }

    if (email) {
      await sendOTPviaEmail(email, otp);
    }

    return NextResponse.json({
      message: 'OTP sent successfully',
      sessionData: {
        email,
        phone,
        name,
        password: hashedPassword,
        otp: hashedOTP,
        otpExpires
      }
    });
  } catch (error) {
    console.error('Signup initiate error:', error);
    return NextResponse.json({ error: 'Signup initiation failed' }, { status: 500 });
  }
}
