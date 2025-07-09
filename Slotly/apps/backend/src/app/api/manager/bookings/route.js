
import { NextResponse } from 'next/server';
import{PrismaClinet} from '@/generated/prisma';
import {verifyToken} from '@/middleware/auth';

export async function GET(request) {
    try{
        const authHeader = request.headers.get('Authorization');
        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const {valid, decoded} = await verifyToken(token);
        if(!valid || decoded.role!=='BUSINESS_OWNER'){
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const business = await PrismaClinet.business.findFirst({
            where:{ownerId: decoded.userId},
        })

        if(!business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        const {searchParams} = new URL(request.url);
        const staffId = searchParams.get('staffId');
        const serviceId = searchParams.get('serviceId');
        const date = searchParams.get('date');

        const filters ={
            businessId: business.id,
        }

        if(staffId) {
            filters.staffId = staffId;
        }
        if(serviceId) {
            filters.serviceId = serviceId;
        }

        if(date){
            const parsedDate = new Date(date);
            if(isNaN(parsedDate.getTime())) {
                return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
            }

            const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(parsedDate.setHours(23, 59,59, 999));
            filters.startTime = {
                gte: startOfDay,
                lte: endOfDay,
            };

            const bookings = await PrismaClinet.booking.findMany({
                where: filters,
                include: {
                    user:{
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    staff:{
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    service:{
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy:{
                    startTime: 'asc',
                }
            });
            
        }
        return NextResponse.json({ bookings }, { status: 200 });
    }catch (error) {
        console.error('Error fetching bookings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}