import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { email, phone, password, name } = await request.json();

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

    const newUser = await prisma.user.create({
      data: {
        email: email ?? null,
        phone: phone ?? null,
        password: hashedPassword,
        name,
        role: 'CUSTOMER', // default
      }
    });

    return NextResponse.json({ message: 'User created successfully', user: newUser }, { status: 201 });

  } catch (error) {
    console.error('Error during signup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
