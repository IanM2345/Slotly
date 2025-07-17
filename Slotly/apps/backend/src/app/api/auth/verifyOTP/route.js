import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const { userId, otp } = await request.json();

    if (!userId || !otp) {
      return NextResponse.json({ error: 'Missing userId or OTP' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.otpVerified) {
      return NextResponse.json({ error: 'User already verified' }, { status: 400 });
    }

    if (!user.otp || !user.otpExpiresAt || new Date() > new Date(user.otpExpiresAt)) {
      return NextResponse.json({ error: 'OTP expired or invalid' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { otpVerified: true, otp: null, otpExpiresAt: null }
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      message: 'Signup and verification successful!',
      token,
      user: { id: user.id, name: user.name, role: user.role }
    }, { status: 200 });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
