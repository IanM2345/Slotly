
import {NextResponse} from 'next/server';
import {PrismaClient} from '@generated/prisma';
import {verifyToken} from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
    try{
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const token = authHeader.split(' ')[1];
        const user = await verifyToken(token);
        if (!user || !user.userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const { valid, decoded } = await verifyToken(token);

        if (!valid || !decoded || !decoded.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = decoded.userId;

        const referrals = await prisma.referral.findMany({
            where: {referrerId: decoded.userId},
            include:{
                referredUser:{
                    select:{
                        id: true,
                        email: true,
                        name:true,
                        createdAt: true,
                        updatedAt: true,
                        bookings: {
                            where: {
                                status: 'COMPLETED'
                            },
                            select: {
                                id: true,
                        },
                    },
                },
            },
            },
        });

        const enrichedReferrals = referrals.map(r => ({
            id: r.id,
            referredUserId: r.referredUser.id,
            name: r.referredUser.name,
            email: r.referredUser.email,
            joinedAt: r.referredUser.createdAt,
            completedBookings: r.referredUser.bookings.length,
            rewardIssued: r.rewardIssued
        }));

        return NextResponse.json(enrichedReferrals, {status: 200});
    }catch (error) {
        console.error('Error fetching referrals:', error);
        return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
    }
}

export async function POST(request) {
    try{
        const {referrerId, referredUserId} = await request.json();

        if (!referrerId || !referredUserId) {
            return NextResponse.json({error: 'Missing required fields'}, {status: 400});
        }

        const existingReferral = await prisma.referral.findFirst({
            where: {
                referrerId,
                referredUserId
            }
        });

        if (existingReferral) {
            return NextResponse.json({error: 'Referral already exists'}, {status: 400});
        }

        const newRefrral = await prisma.referral.create({
            data: {
                referrerId,
                referredUserId
            }
        });

        return NextResponse.json(newRefrral, {status: 201});
    }catch (error) {
        console.error('Error creating referral:', error);
        return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
    }
}