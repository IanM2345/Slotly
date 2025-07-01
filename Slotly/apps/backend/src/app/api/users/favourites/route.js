
import {NextResponse} from 'next/server';
import {PrismaClinet} from '@/generated/prisma';
import {verifyToken} from '@/middleware/auth';

const prisma = new PrismaClinet();

export async function GET(request) {
    try{
        const authHeader = request.headers.get('Authorization');
        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const token = authHeader.split(' ')[1];
        const userId = await verifyToken(token);
        if (!userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }
        const {valid,decoded} = await verifyToken(token);
        if(!valid || !decoded || !decoded.userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const favourites = await prisma.favorite.findMany({
            where:{userId: decoded.userId},
            include: {
                business:true,
                staff:{
                    select:{
                        id:true,
                        name:true,
                        phone:true,
                        role:true,
                    },
                },
            },
        });
        return NextResponse.json(favourites, {status: 200});
    }catch (error) {
        console.error('Error fetching favourites:', error);
        return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
    }
}

export async function POST(request) {
    try{
        const authHeader = request.headers.get('Authorization');
        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const token = authHeader.split(' ')[1];
        const userId = await verifyToken(token);
        if (!userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }
        const {valid,decoded} = await verifyToken(token);
        if(!valid || !decoded || !decoded.userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const body = await request.json();
        const {businessId, staffId} = body;

        if (!businessId && !staffId) {
            return NextResponse.json({error: 'Business ID and Staff ID are required'}, {status: 400});
        }

        const existingFavourite = await prisma.favorite.findFirst({
            where: {
                userId: decoded.userId,
              ...( businessId&& {businessId}),
              ...(staffId&& {staffId}),
            },
        });

        if (existingFavourite) {
            return NextResponse.json({error: 'Favourite already exists'}, {status: 400});
        }
        const newFavourite = await prisma.favorite.create({
            data: {
                userId: decoded.userId,
                businessId: businessId||undefined,
                staffId: staffId||undefined,
            },
        });
        return NextResponse.json(newFavourite, {status: 201});
    }catch (error) {
        console.error('Error adding favourite:', error);
        return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
    }
}

export async function DELETE(request) {
    try{
        const authHeader = request.headers.get('Authorization');
        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const token = authHeader.split(' ')[1];
        const userId = await verifyToken(token);
        if (!userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }
        const {valid,decoded} = await verifyToken(token);
        if(!valid || !decoded || !decoded.userId) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const { searchParams } = new URL(request.url);
        const businessId = searchParams.get('businessId');
        const staffId = searchParams.get('staffId');

        if (!businessId && !staffId) {
            return NextResponse.json({error: 'Business ID or Staff ID is required'}, {status: 400});
        }

        const whereClause = {
            userId: decoded.userId,
            ...(businessId && {businessId}),
            ...(staffId && {staffId}),
        };

        const deletedFavourite = await prisma.favorite.deleteMany({
            where: whereClause,
        });

        if (deletedFavourite.count === 0) {
            return NextResponse.json({error: 'Favourite not found'}, {status: 404});
        }

        return NextResponse.json({message: 'Favourite deleted successfully'}, {status: 200});
    }catch (error) {
        console.error('Error deleting favourite:', error);
        return NextResponse.json({error: 'Internal Server Error'}, {status: 500});
    }
}