
import {NextResponse} from 'next/server';
import {PrismaClient} from '@/generated/prisma';
import {verifyToken} from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }
    const token = authHeader.split(' ')[1];
    const {valid, decoded} = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    const business = await prisma.business.findFirst({
        where: {iownerId: decoded.userId},
        select:{id: true},
    });

    if (!business) {
      return NextResponse.json({error: 'Business not found'}, {status: 404});
    }

    const {searchParams} = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const requests = await prisma.timeOffRequest.findMany({
      where: {
        staff: {
          staffOf: {
            some: { id: business.id }
          }
        },
        ...(status ? { status } : {})
      },
      include: {
        staff: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({timeOffRequests: requests}, {status: 200});
 }catch (error) {
    console.error('GET /timeoff error:', error);
    return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
  }
}

export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }
    const token = authHeader.split(' ')[1];
    const {valid, decoded} = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId }, 
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({error: 'Business not found'}, {status: 404});
    }

    const {id, status, startDate, endDate} = await request.json();

    if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({error: 'Invalid request data'}, {status: 400});
    }

    const requestEntry = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            staffOf: true,
            id: true,
            name: true
          },
        },
      },
    });

    if (!requestEntry || !requestEntry.staff.staffOf.some(b => b.id === business.id)) {
      return NextResponse.json({error: 'Request not found or not associated with your business'}, {status: 404});
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {})
      }
    });

    await createNotification({
      userId: requestEntry.staff.id,
      type: 'TIME_OFF',
      title: status === 'APPROVED' ? 'Time Off Approved' : 'Time Off Rejected',
      message: `Your time off request (${requestEntry.startDate.toISOString().split('T')[0]} to ${requestEntry.endDate.toISOString().split('T')[0]}) has been ${status.toLowerCase()}.`,
      metadata: { requestId: id }
    });

    return NextResponse.json({updated},{status: 200});
  } catch (error) {
    console.error('PATCH /timeoff error:', error);
    return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
  }
}

export async function PUT(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { id, status, startDate, endDate, reason } = await request.json();

    if (!id || !status || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const requestEntry = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: { staff: { select: { id: true, staffOf: true } } }
    });

    if (!requestEntry || !requestEntry.staff.staffOf.some(b => b.id === business.id)) {
      return NextResponse.json({ error: 'Request not found or unauthorized' }, { status: 404 });
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: {
        status,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        reviewedAt: new Date()
      }
    });

    await createNotification({
      userId: requestEntry.staff.id,
      type: 'TIME_OFF',
      title: `Time Off ${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}`,
      message: `Your time off request from ${startDate} to ${endDate} has been ${status.toLowerCase()}.`,
      metadata: { requestId: id }
    });

    return NextResponse.json({ updated }, { status: 200 });
  } catch (error) {
    console.error('PUT /manager/timeoff error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing request ID' }, { status: 400 });
    }

    const requestEntry = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: { staff: { select: { id: true, staffOf: true } } }
    });

    if (!requestEntry || !requestEntry.staff.staffOf.some(b => b.id === decoded.userId)) {
      return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 404 });
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date() }
    });

    await createNotification({
      userId: requestEntry.staff.id,
      type: 'TIME_OFF',
      title: `Time Off Rejected`,
      message: `Your time off request was rejected by the manager.`,
      metadata: { requestId: id }
    });

    return NextResponse.json({ message: 'Time-off forcibly rejected', updated }, { status: 200 });
  } catch (error) {
    console.error('DELETE /manager/timeoff error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
