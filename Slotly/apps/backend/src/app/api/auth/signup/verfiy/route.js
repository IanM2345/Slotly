
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const { email, phone, name, password, otp, otpEntered, otpExpires, referralCode } = await request.json();

    if (!otpEntered || !otp || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (Date.now() > new Date(otpExpires)) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(otpEntered, otp);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email ?? '' }, { phone: phone ?? '' }]
      }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        phone,
        name,
        password,
        role: 'CUSTOMER',
        otpVerified: true
      }
    });

    if (referralCode) {
      const referrer = await prisma.user.findFirst({ where: { referralCode } });
      if (referrer) {
        await prisma.referral.create({
          data: {
            referrerId: referrer.id,
            referredUserId: newUser.id
          }
        });

        await prisma.notification.create({
          data: {
            userId: referrer.id,
            type: 'REFERRAL',
            title: '🎉 Someone Used Your Referral Code!',
            message: `${newUser.name} signed up with your code. After 2 bookings, they’ll earn you a reward.`
          }
        });
      }
    }

    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      message: 'User created successfully',
      token,
      user: { id: newUser.id, name: newUser.name, role: newUser.role }
    });
  } catch (error) {
    console.error('Signup verify error:', error);
    return NextResponse.json({ error: 'Signup verification failed' }, { status: 500 });
  }
}
