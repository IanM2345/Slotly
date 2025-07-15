import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { authenticateRequest } from '@/middleware/auth';

const prisma = new PrismaClient();


export async function GET(req) {
  const auth = await authenticateRequest(req);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const flaggedReviews = await prisma.review.findMany({
    where: { flagged: true },
    include: {
      user: { select: { id: true, name: true, email: true } },
      business: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    flaggedReviews,
  });
}


export async function PATCH(req) {
  const auth = await authenticateRequest(req);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, id } = body;

  if (!type || !id) {
    return NextResponse.json({ error: 'Missing type or id' }, { status: 400 });
  }

  try {
    switch (type) {
      case 'review':
        await prisma.review.update({
          where: { id },
          data: { flagged: false },
        });
        return NextResponse.json({ message: `Review ${id} unflagged.` });

      
      default:
        return NextResponse.json({ error: 'Unsupported flag type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Unflagging failed:', error);
    return NextResponse.json({ error: 'Failed to unflag item' }, { status: 500 });
  }
}