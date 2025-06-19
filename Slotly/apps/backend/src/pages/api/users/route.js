import {NextResponse} from "next/server";
import {PrismaClient} from "../../generated/prisma";

const prisma = new PrismaClient();

export async function POST(request) {
    try{
        const data = await request.json();
        console.log("Received data:", data);
        const {email, password} = data;
        const newUser = await prisma.user.create({
            data: {
                email,
                password,
            },
    });
    return NextResponse.json(newUser);
}catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({error: "Failed to create user"}, {status: 500});
  }

}