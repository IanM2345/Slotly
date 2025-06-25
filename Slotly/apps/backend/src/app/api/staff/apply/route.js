
import {NextResponse} from 'next/server';
import {PrismaClient} from '@/generated/prisma';
import {getServerSession} from 'next-auth';
import {verifyJWT} from '@/middleware/auth';

export async function POST(req){
    try{
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decode = verifyJWT(token);
        if(!decoded || decoded.role !== 'CUSTOMER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
        }

        const body = await req.json();
        const { businessId, idNumber, idPhotoUrl, selfieWithIdUrl } = body;

        if(!businessId || !idNumber || !idPhotoUrl || !selfieWithIdUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const business = await prisma.business.findUnique({
            where: { id: businessId }
        });

        if(!business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        const existingApp= await prisma.staffEnrollment.findFirst({
            where: {
                businessId,
                userId: decode.id
            }
        });

        if(existingApp) {
            return NextResponse.json({ error: 'You have already applied for this business' }, { status: 409 });
        }

        const newApplication = await prisma.staffEnrollment.create({
            data: {
                businessId,
                userId: decode.id,
                idNumber,
                idPhotoUrl,
                selfieWithIdUrl
            }
        });

        return NextResponse.json(newApplication, { status: 201 });
    }catch (error) {
        console.error('Error processing application:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}