import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// UPDATE user
export async function PUT(request, context) {
  try {
    const data = await request.json();
    const userId = context.params.id;
    const { name, email, role } = data;

    // Check for email conflict
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, email, role },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(request, context) {
  try {
    const userId = context.params.id;

    const deletedUser = await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json(deletedUser);
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
