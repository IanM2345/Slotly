import {NextResponse} from 'next/server';
import {PrismaClient} from '@/generated/prisma';

const prisma = new PrismaClient();

// New booking
export async function POST(request) {

    try {
        const data = await request.json();
        const {businessId, userId, serviceId, startTime} = data;

        if(!userId || !businessId || !serviceId || !startTime) {
            return NextResponse.json({error: 'Missing required fields'}, {status: 400});
        }

        // Retrieve service to get duration
        const service = await prisma.service.findUnique({
            where: {id: serviceId},
            select: {duration: true}
        });

        if (!service) {
            return NextResponse.json({error: 'Service not found'}, {status: 404});
        }

        const start = new Date(startTime);
        const end = new Date(start.getTime() + service.duration * 60000); // Convert duration from minutes to milliseconds
        
        const booking = await prisma.booking.create({
            data: {
                userId,
                businessId,
                serviceId,
                startTime: start,
                endTime: end
            }
        });

        return NextResponse.json(booking, {status: 201});
    
}  catch (error) {
        console.error('Error creating booking:', error);
        return NextResponse.json({error: 'Internal server error'}, {status: 500});
    }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const businessId = searchParams.get('businessId');
    const serviceId = searchParams.get('serviceId');

    const filters = {};
    if (userId) filters.userId = userId;
    if (businessId) filters.businessId = businessId;
    if (serviceId) filters.serviceId = serviceId;

    const bookings = await prisma.booking.findMany({
      where: filters,
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}