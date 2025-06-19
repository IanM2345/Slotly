import {NextResponse} from "next/server";
import {PrismaClient} from "../../generated/prisma";
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST (request: Request){
    try{
        const data = await request.json();
        console.log("Received data:", data);

        const{email,password,role="CUSTOMER",name}=data;

        //Validate input
        if(!email || !password || !name){
            return NextResponse.json({error: "Email, password, and name are required fields."}, {status: 400});
        }

        //Check if user already exists
        const existingUser = await prisma.user.findUnique({where: {email}});
        if(existingUser){
            return NextResponse.json({error: "Email already in use."}, {status: 400});
        }

        //Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role,
                name
            },
    });

    return NextResponse.json({message: "User created", user: newUser}, {status: 201});
}catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({error: "User Creation Failed"}, {status: 500});
}
}

export async function GET() {
    try{

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                name: true,
                createdAt: true,
            },
    });

    return NextResponse.json(users, {status: 200});
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({error: "Failed to fetch users"}, {status: 500});
    }
}